const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'Admin privileges required'
    });
  }
  next();
};

/**
 * POST /api/admin/drivers/:driverId/verify
 * Verify or reject driver application
 */
router.post('/drivers/:driverId/verify', authenticate, requireAdmin, adminLimiter, async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { verificationStatus, rejectionReason } = req.body;

    // Validate verification status
    const validStatuses = ['approved', 'rejected'];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if rejection reason is provided for rejection
    if (verificationStatus === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        error: 'Missing rejection reason',
        message: 'Rejection reason is required when rejecting a driver'
      });
    }

    // Get driver document
    const driverRef = db.collection('drivers').doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: 'The requested driver profile does not exist'
      });
    }

    const driverData = driverDoc.data();

    // Validate driver documents are uploaded
    if (!driverData.documentsSubmitted) {
      return res.status(400).json({
        success: false,
        error: 'Documents not submitted',
        message: 'Driver must submit all required documents before verification'
      });
    }

    // Update driver verification status
    const updateData = {
      verificationStatus,
      verified: verificationStatus === 'approved',
      verifiedAt: verificationStatus === 'approved' ? FieldValue.serverTimestamp() : null,
      verifiedBy: req.user.uid,
      verificationUpdatedAt: FieldValue.serverTimestamp()
    };

    if (verificationStatus === 'rejected') {
      updateData.rejectionReason = rejectionReason;
      updateData.rejectedAt = FieldValue.serverTimestamp();
    }

    await driverRef.update(updateData);

    // Create verification audit log
    const auditData = {
      driverId,
      verificationStatus,
      rejectionReason: rejectionReason || null,
      verifiedBy: req.user.uid,
      verifiedByRole: 'admin',
      createdAt: FieldValue.serverTimestamp(),
      previousStatus: driverData.verificationStatus,
      documents: driverData.documents || {}
    };

    await db.collection('verifications').add(auditData);

    // Update user role if approved
    if (verificationStatus === 'approved') {
      await db.collection('users').doc(driverId).update({
        role: 'driver',
        driverVerifiedAt: FieldValue.serverTimestamp()
      });
    }

    // Send notification to driver
    await createNotification(driverId, 'verification_update', {
      status: verificationStatus,
      reason: rejectionReason || null,
      adminName: req.user.name || 'Admin'
    });

    logger.info(`Driver ${driverId} verification ${verificationStatus} by admin ${req.user.uid}`);

    res.status(200).json({
      success: true,
      message: `Driver verification ${verificationStatus} successfully`,
      data: {
        driverId,
        verificationStatus,
        verified: verificationStatus === 'approved',
        verifiedAt: verificationStatus === 'approved' ? new Date().toISOString() : null,
        rejectionReason: rejectionReason || null
      }
    });

  } catch (error) {
    logger.error('Error verifying driver:', error);
    next(error);
  }
});

/**
 * GET /api/admin/drivers/pending
 * Get list of drivers with pending verification status
 */
router.get('/drivers/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, sortBy = 'submissionDate' } = req.query;

    // Validate sort options
    const validSortOptions = ['submissionDate', 'rating', 'name'];
    if (!validSortOptions.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sort option',
        message: `Sort must be one of: ${validSortOptions.join(', ')}`
      });
    }

    // Build query
    let query = db.collection('drivers')
      .where('verificationStatus', '==', 'pending')
      .where('documentsSubmitted', '==', true);

    // Apply sorting
    switch (sortBy) {
      case 'submissionDate':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'rating':
        query = query.orderBy('rating', 'desc');
        break;
      case 'name':
        // Name sorting would require additional query logic
        query = query.orderBy('createdAt', 'desc');
        break;
    }

    // Apply pagination
    const limitInt = Math.min(parseInt(limit), 100); // Max 100
    const offsetInt = parseInt(offset);

    const snapshot = await query.limit(limitInt).offset(offsetInt).get();

    const pendingDrivers = [];

    for (const doc of snapshot.docs) {
      const driverData = doc.data();
      const userDoc = await db.collection('users').doc(doc.id).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      pendingDrivers.push({
        id: doc.id,
        name: userData.name || 'Unknown',
        phoneNumber: userData.phoneNumber,
        email: userData.email,
        submittedAt: driverData.createdAt,
        rating: driverData.rating || 0,
        vehicleInfo: driverData.vehicleInfo || {},
        documents: driverData.documents || {},
        applicationInfo: {
          completedTrips: driverData.completedTrips || 0,
          experience: driverData.experience || '',
          availability: driverData.availability || {}
        }
      });
    }

    // Get total count for pagination
    const countSnapshot = await db.collection('drivers')
      .where('verificationStatus', '==', 'pending')
      .where('documentsSubmitted', '==', true)
      .count()
      .get();

    const totalCount = countSnapshot.data().count;

    res.status(200).json({
      success: true,
      data: {
        drivers: pendingDrivers,
        pagination: {
          total: totalCount,
          limit: limitInt,
          offset: offsetInt,
          hasMore: (offsetInt + pendingDrivers.length) < totalCount
        },
        filters: {
          sortBy,
          status: 'pending'
        }
      }
    });

  } catch (error) {
    logger.error('Error getting pending drivers:', error);
    next(error);
  }
});

/**
 * GET /api/admin/analytics/dashboard
 * Get dashboard analytics
 */
router.get('/analytics/dashboard', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { timeRange = 'today' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to today
    }

    // Get key metrics
    const [
      activeUsersSnapshot,
      completedRidesSnapshot,
      completedDeliveriesSnapshot,
      totalRevenueSnapshot,
      activeDriversSnapshot,
      pendingVerificationsSnapshot
    ] = await Promise.all([
      db.collection('users')
        .where('isActive', '==', true)
        .count()
        .get(),

      db.collection('rides')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', startDate)
        .count()
        .get(),

      db.collection('deliveries')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', startDate)
        .count()
        .get(),

      db.collection('payments')
        .where('status', '==', 'completed')
        .where('createdAt', '>=', startDate)
        .get(),

      db.collection('drivers')
        .where('isOnline', '==', true)
        .count()
        .get(),

      db.collection('drivers')
        .where('verificationStatus', '==', 'pending')
        .count()
        .get()
    ]);

    // Calculate total revenue
    let totalRevenue = 0;
    totalRevenueSnapshot.forEach(doc => {
      const paymentData = doc.data();
      totalRevenue += paymentData.amount || 0;
    });

    // Get recent activity
    const recentActivity = await getRecentActivity(startDate);

    // Get growth metrics
    const growthMetrics = await getGrowthMetrics(startDate);

    const analytics = {
      timeRange,
      period: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      metrics: {
        activeUsers: activeUsersSnapshot.data().count,
        completedRides: completedRidesSnapshot.data().count,
        completedDeliveries: completedDeliveriesSnapshot.data().count,
        totalTrips: completedRidesSnapshot.data().count + completedDeliveriesSnapshot.data().count,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        activeDrivers: activeDriversSnapshot.data().count,
        pendingVerifications: pendingVerificationsSnapshot.data().count
      },
      recentActivity,
      growthMetrics,
      lastUpdated: now.toISOString()
    };

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error getting dashboard analytics:', error);
    next(error);
  }
});

/**
 * POST /api/admin/drivers/:driverId/suspend
 * Suspend or reactivate a driver
 */
router.post('/drivers/:driverId/suspend', authenticate, requireAdmin, adminLimiter, async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { reason, duration, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing reason',
        message: 'Suspension reason is required'
      });
    }

    // Validate duration (in days)
    const durationDays = parseInt(duration) || 30;
    if (durationDays < 1 || durationDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration',
        message: 'Duration must be between 1 and 365 days'
      });
    }

    // Get driver document
    const driverRef = db.collection('drivers').doc(driverId);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: 'The requested driver profile does not exist'
      });
    }

    const driverData = driverDoc.data();

    // Calculate suspension end date
    const suspensionEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Update driver status
    await driverRef.update({
      suspended: true,
      suspensionReason: reason,
      suspensionNotes: notes || '',
      suspendedAt: FieldValue.serverTimestamp(),
      suspensionEndsAt,
      suspendedBy: req.user.uid,
      isOnline: false // Force offline when suspended
    });

    // Remove from available drivers pool
    await removeFromAvailableDrivers(driverId);

    // Create suspension audit log
    const auditData = {
      driverId,
      action: 'suspended',
      reason,
      duration: durationDays,
      notes: notes || '',
      suspendedBy: req.user.uid,
      suspendedByRole: 'admin',
      suspendedAt: FieldValue.serverTimestamp(),
      suspensionEndsAt
    };

    await db.collection('suspensions').add(auditData);

    // Notify affected users (if driver has active rides)
    await notifyAffectedUsers(driverId, reason);

    // Send notification to driver
    await createNotification(driverId, 'driver_suspended', {
      reason,
      duration: durationDays,
      endsAt: suspensionEndsAt.toISOString(),
      adminName: req.user.name || 'Admin'
    });

    logger.info(`Driver ${driverId} suspended by admin ${req.user.uid} for ${durationDays} days`);

    res.status(200).json({
      success: true,
      message: 'Driver suspended successfully',
      data: {
        driverId,
        suspended: true,
        suspensionReason: reason,
        suspensionEndsAt: suspensionEndsAt.toISOString(),
        suspendedBy: req.user.uid
      }
    });

  } catch (error) {
    logger.error('Error suspending driver:', error);
    next(error);
  }
});

/**
 * GET /api/admin/rides/active
 * Get list of active rides for monitoring
 */
router.get('/rides/active', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, dateRange, driverFilter } = req.query;

    // Build query for active rides
    let query = db.collection('rides');

    const validStatuses = ['requesting', 'accepted', 'in_progress'];
    const statusFilter = status && validStatuses.includes(status) ? status : null;

    if (statusFilter) {
      query = query.where('status', '==', statusFilter);
    } else {
      query = query.where('status', 'in', validStatuses);
    }

    // Apply date range filter if provided
    if (dateRange) {
      const [start, end] = dateRange.split(',');
      if (start && end) {
        query = query.where('createdAt', '>=', new Date(start))
                    .where('createdAt', '<=', new Date(end));
      }
    }

    // Apply driver filter if provided
    if (driverFilter) {
      query = query.where('driverId', '==', driverFilter);
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const activeRides = [];

    for (const doc of snapshot.docs) {
      const rideData = doc.data();

      // Get user and driver details
      const [userDoc, driverDoc] = await Promise.all([
        db.collection('users').doc(rideData.userId).get(),
        rideData.driverId ? db.collection('users').doc(rideData.driverId).get() : Promise.resolve({ exists: false })
      ]);

      const userData = userDoc.exists ? userDoc.data() : {};
      const driverData = driverDoc.exists ? driverDoc.data() : {};

      activeRides.push({
        id: doc.id,
        status: rideData.status,
        user: {
          id: rideData.userId,
          name: userData.name || 'User',
          phone: userData.phoneNumber
        },
        driver: rideData.driverId ? {
          id: rideData.driverId,
          name: driverData.name || 'Driver',
          phone: driverData.phoneNumber,
          rating: driverData.rating || 4.5
        } : null,
        pickup: rideData.pickup,
        destination: rideData.destination,
        fare: rideData.fare,
        vehicleType: rideData.vehicleType,
        createdAt: rideData.createdAt,
        acceptedAt: rideData.acceptedAt,
        startedAt: rideData.startedAt,
        estimatedTime: rideData.estimatedTime
      });
    }

    res.status(200).json({
      success: true,
      data: {
        rides: activeRides,
        count: activeRides.length,
        filters: {
          status: statusFilter || 'all',
          dateRange: dateRange || null,
          driverFilter: driverFilter || null
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting active rides:', error);
    next(error);
  }
});

// Helper functions

async function getRecentActivity(startDate) {
  try {
    const [
      recentRides,
      recentDeliveries,
      recentVerifications
    ] = await Promise.all([
      db.collection('rides')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', startDate)
        .orderBy('completedAt', 'desc')
        .limit(5)
        .get(),

      db.collection('deliveries')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', startDate)
        .orderBy('completedAt', 'desc')
        .limit(5)
        .get(),

      db.collection('verifications')
        .where('createdAt', '>=', startDate)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get()
    ]);

    const activities = [];

    recentRides.forEach(doc => {
      const rideData = doc.data();
      activities.push({
        type: 'ride_completed',
        id: doc.id,
        userId: rideData.userId,
        driverId: rideData.driverId,
        amount: rideData.fare?.total || 0,
        timestamp: rideData.completedAt
      });
    });

    recentDeliveries.forEach(doc => {
      const deliveryData = doc.data();
      activities.push({
        type: 'delivery_completed',
        id: doc.id,
        senderId: deliveryData.senderId,
        driverId: deliveryData.driverId,
        amount: deliveryData.cost?.total || 0,
        timestamp: deliveryData.completedAt
      });
    });

    recentVerifications.forEach(doc => {
      const verificationData = doc.data();
      activities.push({
        type: 'driver_verification',
        id: doc.id,
        driverId: verificationData.driverId,
        status: verificationData.verificationStatus,
        timestamp: verificationData.createdAt
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, 10);
  } catch (error) {
    logger.error('Error getting recent activity:', error);
    return [];
  }
}

async function getGrowthMetrics(startDate) {
  try {
    const previousPeriodStart = new Date(startDate.getTime() - (new Date() - startDate));
    const previousPeriodEnd = startDate;

    const [
      currentUsers,
      previousUsers,
      currentRides,
      previousRides
    ] = await Promise.all([
      db.collection('users')
        .where('createdAt', '>=', startDate)
        .count()
        .get(),

      db.collection('users')
        .where('createdAt', '>=', previousPeriodStart)
        .where('createdAt', '<', previousPeriodEnd)
        .count()
        .get(),

      db.collection('rides')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', startDate)
        .count()
        .get(),

      db.collection('rides')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', previousPeriodStart)
        .where('completedAt', '<', previousPeriodEnd)
        .count()
        .get()
    ]);

    return {
      newUsers: {
        current: currentUsers.data().count,
        previous: previousUsers.data().count,
        growth: calculateGrowth(currentUsers.data().count, previousUsers.data().count)
      },
      completedRides: {
        current: currentRides.data().count,
        previous: previousRides.data().count,
        growth: calculateGrowth(currentRides.data().count, previousRides.data().count)
      }
    };
  } catch (error) {
    logger.error('Error calculating growth metrics:', error);
    return {
      newUsers: { current: 0, previous: 0, growth: 0 },
      completedRides: { current: 0, previous: 0, growth: 0 }
    };
  }
}

function calculateGrowth(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

async function removeFromAvailableDrivers(driverId) {
  try {
    await db.collection('available_drivers').doc(driverId).delete();
  } catch (error) {
    logger.error('Error removing driver from available pool:', error);
  }
}

async function notifyAffectedUsers(driverId, reason) {
  try {
    // Find active rides for this driver
    const activeRides = await db.collection('rides')
      .where('driverId', '==', driverId)
      .where('status', 'in', ['accepted', 'in_progress'])
      .get();

    activeRides.forEach(async (doc) => {
      const rideData = doc.data();
      await createNotification(rideData.userId, 'ride_driver_suspended', {
        rideId: doc.id,
        reason,
        driverId
      });
    });
  } catch (error) {
    logger.error('Error notifying affected users:', error);
  }
}

async function createNotification(userId, type, data) {
  try {
    await db.collection('notifications').add({
      userId,
      type,
      data,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
  }
}

module.exports = router;