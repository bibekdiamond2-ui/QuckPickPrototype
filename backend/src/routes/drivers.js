const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { locationLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

/**
 * POST /api/drivers/location-update
 * Update driver's current location
 */
router.post('/location-update', authenticate, locationLimiter, async (req, res, next) => {
  try {
    const { latitude, longitude, heading, speed, timestamp } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can update location'
      });
    }

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing coordinates',
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        message: 'Coordinates must be valid latitude and longitude values'
      });
    }

    // Validate movement (reasonable speed and distance)
    const speedValue = speed ? parseFloat(speed) : 0;
    if (speedValue > 200) { // 200 km/h max
      return res.status(400).json({
        success: false,
        error: 'Invalid speed',
        message: 'Speed value is unrealistic'
      });
    }

    // Get previous location for validation
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (driverDoc.exists) {
      const driverData = driverDoc.data();
      if (driverData.currentLocation && driverData.locationUpdatedAt) {
        const lastUpdate = driverData.locationUpdatedAt.toDate();
        const timeDiff = (new Date() - lastUpdate) / 1000; // seconds
        const distance = calculateDistance(driverData.currentLocation, { latitude: lat, longitude: lng });

        // Check if movement is reasonable (max 100km in 30 seconds)
        if (timeDiff < 30 && distance > 100) {
          return res.status(400).json({
            success: false,
            error: 'Invalid movement',
            message: 'Location update is too far from previous location'
          });
        }
      }
    }

    // Update driver location
    const locationUpdate = {
      currentLocation: {
        latitude: lat,
        longitude: lng
      },
      locationUpdatedAt: FieldValue.serverTimestamp(),
      heading: heading ? parseFloat(heading) : null,
      speed: speedValue
    };

    await db.collection('drivers').doc(driverId).update(locationUpdate);

    // Find nearby ride requests if driver is online
    let nearbyRequests = [];
    if (driverDoc.exists && driverDoc.data().isOnline) {
      nearbyRequests = await findNearbyRideRequests(lat, lng, 5); // 5km radius
    }

    logger.debug(`Location updated for driver ${driverId}: ${lat}, ${lng}`);

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        location: {
          latitude: lat,
          longitude: lng,
          heading,
          speed: speedValue,
          timestamp: timestamp || new Date().toISOString()
        },
        nearbyRequests: nearbyRequests.slice(0, 3), // Return max 3 nearby requests
        requestCount: nearbyRequests.length
      }
    });

  } catch (error) {
    logger.error('Error updating driver location:', error);
    next(error);
  }
});

/**
 * POST /api/drivers/availability-toggle
 * Toggle driver availability (online/offline)
 */
router.post('/availability-toggle', authenticate, async (req, res, next) => {
  try {
    const { isOnline, currentLocation } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can toggle availability'
      });

  }

    // Get driver document
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver profile not found',
        message: 'Driver profile must be created first'
      });
    }

    const driverData = driverDoc.data();

    // Validate driver is verified when going online
    if (isOnline && !driverData.verified) {
      return res.status(403).json({
        success: false,
        error: 'Driver not verified',
        message: 'Driver must be verified to go online'
      });
    }

    // Validate location when going online
    if (isOnline && (!currentLocation || !currentLocation.latitude || !currentLocation.longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Missing location',
        message: 'Current location is required when going online'
      });
    }

    // Update driver availability
    const updateData = {
      isOnline: Boolean(isOnline),
      availabilityChangedAt: FieldValue.serverTimestamp()
    };

    if (isOnline) {
      updateData.currentLocation = {
        latitude: parseFloat(currentLocation.latitude),
        longitude: parseFloat(currentLocation.longitude)
      };
      updateData.lastOnlineAt = FieldValue.serverTimestamp();
    } else {
      updateData.lastOfflineAt = FieldValue.serverTimestamp();
    }

    await db.collection('drivers').doc(driverId).update(updateData);

    // Update availability in driver pool
    if (isOnline) {
      await addToAvailableDrivers(driverId, currentLocation);
    } else {
      await removeFromAvailableDrivers(driverId);
    }

    logger.info(`Driver ${driverId} availability toggled to: ${isOnline ? 'online' : 'offline'}`);

    res.status(200).json({
      success: true,
      message: `Availability ${isOnline ? 'enabled' : 'disabled'} successfully`,
      data: {
        driverId,
        isOnline: Boolean(isOnline),
        queuePosition: isOnline ? await getQueuePosition(driverId) : null,
        availableDrivers: isOnline ? await getAvailableDriversCount() : null
      }
    });

  } catch (error) {
    logger.error('Error toggling driver availability:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/nearby
 * Get nearby available drivers
 */
router.get('/nearby', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5, vehicleType } = req.query;

    // Validate coordinates
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing coordinates',
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusKm = parseFloat(radius);

    // Find nearby drivers
    const nearbyDrivers = await findNearbyDrivers(lat, lng, radiusKm, vehicleType);

    // Apply caching (30 seconds)
    const cacheKey = `nearby_drivers_${lat}_${lng}_${radiusKm}_${vehicleType || 'all'}`;
    // In a real implementation, you would use Redis or similar caching

    res.status(200).json({
      success: true,
      data: {
        drivers: nearbyDrivers,
        count: nearbyDrivers.length,
        searchCenter: { latitude: lat, longitude: lng },
        searchRadius: radiusKm,
        searchTime: new Date().toISOString(),
        cacheExpiry: new Date(Date.now() + 30 * 1000).toISOString()
      }
    });

  } catch (error) {
    logger.error('Error finding nearby drivers:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/earnings/:driverId
 * Get driver earnings information
 */
router.get('/earnings/:driverId', authenticate, async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const userId = req.user.uid;
    const { startDate, endDate, limit = 50, offset = 0 } = req.query;

    // Validate permissions
    if (userId !== driverId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only view your own earnings'
      });
    }

    // Validate date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
    const end = endDate ? new Date(endDate) : new Date();

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'Start date must be before end date'
      });
    }

    // Get completed rides for the driver
    const ridesQuery = await db.collection('rides')
      .where('driverId', '==', driverId)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', start)
      .where('completedAt', '<=', end)
      .orderBy('completedAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    // Get completed deliveries for the driver
    const deliveriesQuery = await db.collection('deliveries')
      .where('driverId', '==', driverId)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', start)
      .where('completedAt', '<=', end)
      .orderBy('completedAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    // Get payment records
    const paymentsQuery = await db.collection('payments')
      .where('driverId', '==', driverId)
      .where('status', '==', 'completed')
      .where('createdAt', '>=', start)
      .where('createdAt', '<=', end)
      .orderBy('createdAt', 'desc')
      .get();

    // Calculate earnings
    let totalEarnings = 0;
    let rideEarnings = 0;
    let deliveryEarnings = 0;
    const earningsHistory = [];

    paymentsQuery.forEach(doc => {
      const paymentData = doc.data();
      const amount = paymentData.amount || 0;
      totalEarnings += amount;

      if (paymentData.rideId) {
        rideEarnings += amount;
      } else if (paymentData.deliveryId) {
        deliveryEarnings += amount;
      }

      earningsHistory.push({
        id: doc.id,
        type: paymentData.rideId ? 'ride' : 'delivery',
        amount: amount,
        currency: paymentData.currency || 'INR',
        date: paymentData.createdAt,
        rideId: paymentData.rideId || null,
        deliveryId: paymentData.deliveryId || null,
        status: paymentData.status
      });
    });

    // Get driver statistics
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    const driverData = driverDoc.exists ? driverDoc.data() : {};

    res.status(200).json({
      success: true,
      data: {
        driverId,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        earnings: {
          total: Math.round(totalEarnings * 100) / 100,
          rides: Math.round(rideEarnings * 100) / 100,
          deliveries: Math.round(deliveryEarnings * 100) / 100,
          currency: 'INR'
        },
        statistics: {
          completedRides: ridesQuery.size,
          completedDeliveries: deliveriesQuery.size,
          totalTrips: ridesQuery.size + deliveriesQuery.size,
          averageRating: driverData.rating || 0,
          onlineHours: driverData.totalOnlineHours || 0
        },
        paymentHistory: earningsHistory,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: earningsHistory.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting driver earnings:', error);
    next(error);
  }
});

/**
 * GET /api/drivers/profile/:driverId
 * Get driver profile information
 */
router.get('/profile/:driverId', authenticate, async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const userId = req.user.uid;

    // Get driver document
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    if (!driverDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: 'The requested driver profile does not exist'
      });
    }

    const driverData = driverDoc.data();

    // Get user document for basic info
    const userDoc = await db.collection('users').doc(driverId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Determine privacy level
    const isOwnProfile = userId === driverId;
    const isAdmin = req.user.role === 'admin';

    // Build response based on privacy
    const profileResponse = {
      id: driverId,
      name: userData.name || 'Driver',
      rating: driverData.rating || 4.5,
      completedTrips: driverData.completedTrips || 0,
      isOnline: driverData.isOnline || false,
      verified: driverData.verified || false,
      joinedAt: userData.createdAt || null
    };

    // Add additional info for own profile or admin
    if (isOwnProfile || isAdmin) {
      profileResponse.phoneNumber = userData.phoneNumber || null;
      profileResponse.email = userData.email || null;
      profileResponse.vehicleInfo = driverData.vehicleInfo || {};
      profileResponse.earnings = {
        totalEarnings: driverData.totalEarnings || 0,
        todayEarnings: driverData.todayEarnings || 0
      };
      profileResponse.statistics = {
        acceptanceRate: driverData.acceptanceRate || 0,
        completionRate: driverData.completionRate || 0,
        averageRating: driverData.rating || 0,
        totalOnlineHours: driverData.totalOnlineHours || 0
      };
      profileResponse.verification = {
        status: driverData.verificationStatus || 'pending',
        documentsSubmitted: driverData.documentsSubmitted || false,
        verifiedAt: driverData.verifiedAt || null
      };
    }

    // Add vehicle info for public profiles
    if (!isOwnProfile && !isAdmin) {
      profileResponse.vehicle = {
        type: driverData.vehicleInfo?.type || 'standard',
        color: driverData.vehicleInfo?.color || 'Unknown',
        licensePlate: driverData.vehicleInfo?.licensePlate?.slice(-4) || null // Show last 4 digits
      };
    }

    res.status(200).json({
      success: true,
      data: profileResponse
    });

  } catch (error) {
    logger.error('Error getting driver profile:', error);
    next(error);
  }
});

// Helper functions

function calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

async function findNearbyDrivers(latitude, longitude, radiusKm, vehicleType = null) {
  try {
    // Get all online drivers
    const driversQuery = await db.collection('drivers')
      .where('isOnline', '==', true)
      .where('verified', '==', true)
      .get();

    const nearbyDrivers = [];

    driversQuery.forEach(doc => {
      const driverData = doc.data();
      if (driverData.currentLocation) {
        const distance = calculateDistance(
          { latitude, longitude },
          driverData.currentLocation
        );

        if (distance <= radiusKm) {
          // Filter by vehicle type if specified
          if (!vehicleType || driverData.vehicleInfo?.type === vehicleType) {
            nearbyDrivers.push({
              id: doc.id,
              location: driverData.currentLocation,
              distance: Math.round(distance * 100) / 100,
              vehicleInfo: driverData.vehicleInfo || {},
              rating: driverData.rating || 4.5,
              completedTrips: driverData.completedTrips || 0,
              estimatedArrival: Math.ceil(distance * 3) // 3 minutes per km
            });
          }
        }
      }
    });

    // Sort by distance
    nearbyDrivers.sort((a, b) => a.distance - b.distance);

    return nearbyDrivers;
  } catch (error) {
    logger.error('Error finding nearby drivers:', error);
    return [];
  }
}

async function findNearbyRideRequests(latitude, longitude, radiusKm) {
  try {
    // Get requesting rides
    const ridesQuery = await db.collection('rides')
      .where('status', '==', 'requesting')
      .get();

    const nearbyRequests = [];

    ridesQuery.forEach(doc => {
      const rideData = doc.data();
      const pickupDistance = calculateDistance(
        { latitude, longitude },
        rideData.pickup
      );

      if (pickupDistance <= radiusKm) {
        nearbyRequests.push({
          id: doc.id,
          type: 'ride',
          pickup: rideData.pickup,
          destination: rideData.destination,
          distance: Math.round(pickupDistance * 100) / 100,
          estimatedFare: rideData.fare?.total || 0,
          vehicleType: rideData.vehicleType,
          createdAt: rideData.createdAt
        });
      }
    });

    // Sort by distance and creation time
    nearbyRequests.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return a.createdAt - b.createdAt;
    });

    return nearbyRequests;
  } catch (error) {
    logger.error('Error finding nearby ride requests:', error);
    return [];
  }
}

async function addToAvailableDrivers(driverId, location) {
  try {
    await db.collection('available_drivers').doc(driverId).set({
      driverId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      addedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    logger.error('Error adding driver to available pool:', error);
  }
}

async function removeFromAvailableDrivers(driverId) {
  try {
    await db.collection('available_drivers').doc(driverId).delete();
  } catch (error) {
    logger.error('Error removing driver from available pool:', error);
  }
}

async function getQueuePosition(driverId) {
  try {
    const availableDrivers = await db.collection('available_drivers')
      .orderBy('addedAt', 'asc')
      .get();

    let position = 0;
    availableDrivers.forEach((doc, index) => {
      if (doc.id === driverId) {
        position = index + 1;
      }
    });

    return position;
  } catch (error) {
    logger.error('Error getting queue position:', error);
    return null;
  }
}

async function getAvailableDriversCount() {
  try {
    const snapshot = await db.collection('available_drivers').count().get();
    return snapshot.data().count;
  } catch (error) {
    logger.error('Error getting available drivers count:', error);
    return 0;
  }
}

module.exports = router;