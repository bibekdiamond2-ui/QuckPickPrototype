const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { rideLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

/**
 * POST /api/rides/create
 * Create a new ride request
 */
router.post('/create', authenticate, rideLimiter, async (req, res, next) => {
  try {
    const { pickup, destination, vehicleType, scheduledTime } = req.body;
    const userId = req.user.uid;

    // Validate required fields
    if (!pickup || !destination || !vehicleType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Pickup, destination, and vehicle type are required'
      });
    }

    // Validate pickup and destination coordinates
    if (!pickup.latitude || !pickup.longitude || !destination.latitude || !destination.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        message: 'Pickup and destination must have valid latitude and longitude'
      });
    }

    // Validate pickup ≠ destination
    if (pickup.latitude === destination.latitude && pickup.longitude === destination.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Same locations',
        message: 'Pickup and destination locations must be different'
      });
    }

    // Validate vehicle type
    const validVehicleTypes = ['standard', 'xl', 'premium'];
    if (!validVehicleTypes.includes(vehicleType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vehicle type',
        message: `Vehicle type must be one of: ${validVehicleTypes.join(', ')}`
      });
    }

    // Calculate distance and estimated fare
    const distance = calculateDistance(pickup, destination);
    const fareDetails = calculateFare(distance, vehicleType);
    const estimatedTime = Math.ceil(distance * 2); // Rough estimate: 2 minutes per km

    // Create ride document
    const rideData = {
      userId,
      pickup: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        address: pickup.address || `${pickup.latitude}, ${pickup.longitude}`
      },
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address || `${destination.latitude}, ${destination.longitude}`
      },
      vehicleType,
      status: 'requesting',
      createdAt: FieldValue.serverTimestamp(),
      scheduledTime: scheduledTime || null,
      fare: {
        base: fareDetails.base,
        distance: fareDetails.distance,
        total: fareDetails.total,
        currency: 'INR'
      },
      estimatedTime,
      distance
    };

    const rideRef = await db.collection('rides').add(rideData);
    const rideDoc = await rideRef.get();

    logger.info(`Ride created: ${rideRef.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      data: {
        id: rideRef.id,
        ...rideDoc.data()
      }
    });

  } catch (error) {
    logger.error('Error creating ride:', error);
    next(error);
  }
});

/**
 * GET /api/rides/nearby-drivers
 * Get nearby available drivers
 */
router.get('/nearby-drivers', authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

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
    const nearbyDrivers = await findNearbyDrivers(lat, lng, radiusKm);

    res.status(200).json({
      success: true,
      data: {
        drivers: nearbyDrivers,
        count: nearbyDrivers.length,
        searchCenter: { latitude: lat, longitude: lng },
        searchRadius: radiusKm
      }
    });

  } catch (error) {
    logger.error('Error finding nearby drivers:', error);
    next(error);
  }
});

/**
 * POST /api/rides/:rideId/accept
 * Accept a ride request (driver only)
 */
router.post('/:rideId/accept', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { estimatedArrival } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can accept rides'
      });
    }

    // Get ride document
    const rideRef = db.collection('rides').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    const rideData = rideDoc.data();

    // Validate ride status
    if (rideData.status !== 'requesting') {
      return res.status(400).json({
        success: false,
        error: 'Ride not available',
        message: 'This ride has already been accepted or cancelled'
      });
    }

    // Validate estimated arrival
    if (!estimatedArrival || estimatedArrival < 1 || estimatedArrival > 30) {
      return res.status(400).json({
        success: false,
        error: 'Invalid estimated arrival',
        message: 'Estimated arrival must be between 1 and 30 minutes'
      });
    }

    // Update ride with driver assignment
    const updatedRideData = {
      driverId,
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
      estimatedArrival: estimatedArrival
    };

    await rideRef.update(updatedRideData);

    // Get driver details for response
    const driverDoc = await db.collection('users').doc(driverId).get();
    const driverData = driverDoc.data();

    logger.info(`Ride ${rideId} accepted by driver ${driverId}`);

    res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      data: {
        rideId,
        status: 'accepted',
        driver: {
          id: driverId,
          name: driverData.name || 'Driver',
          phone: driverData.phoneNumber,
          rating: driverData.rating || 4.5
        },
        estimatedArrival
      }
    });

  } catch (error) {
    logger.error('Error accepting ride:', error);
    next(error);
  }
});

/**
 * GET /api/rides/:rideId/tracking
 * Get real-time ride tracking information
 */
router.get('/:rideId/tracking', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.uid;

    // Get ride document
    const rideRef = db.collection('rides').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    const rideData = rideDoc.data();

    // Validate access permissions
    if (rideData.userId !== userId && rideData.driverId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to track this ride'
      });
    }

    let driverLocation = null;
    let driverDetails = null;

    // Get driver location if ride is accepted or in progress
    if (rideData.driverId && (rideData.status === 'accepted' || rideData.status === 'in_progress')) {
      const driverDoc = await db.collection('drivers').doc(rideData.driverId).get();
      if (driverDoc.exists) {
        const driverData = driverDoc.data();
        driverLocation = driverData.currentLocation;

        const userDoc = await db.collection('users').doc(rideData.driverId).get();
        driverDetails = userDoc.data();
      }
    }

    // Calculate updated ETA if driver location is available
    let updatedEta = rideData.estimatedTime;
    if (driverLocation && rideData.status === 'accepted') {
      updatedEta = Math.ceil(calculateDistance(driverLocation, rideData.pickup) * 2);
    }

    res.status(200).json({
      success: true,
      data: {
        rideId,
        status: rideData.status,
        pickup: rideData.pickup,
        destination: rideData.destination,
        driverLocation,
        driver: driverDetails ? {
          id: rideData.driverId,
          name: driverDetails.name || 'Driver',
          phone: driverDetails.phoneNumber,
          rating: driverDetails.rating || 4.5,
          vehicle: driverDetails.vehicleInfo || {}
        } : null,
        estimatedTime: updatedEta,
        fare: rideData.fare,
        createdAt: rideData.createdAt,
        acceptedAt: rideData.acceptedAt,
        startedAt: rideData.startedAt
      }
    });

  } catch (error) {
    logger.error('Error getting ride tracking:', error);
    next(error);
  }
});

/**
 * POST /api/rides/:rideId/complete
 * Mark a ride as complete (driver only)
 */
router.post('/:rideId/complete', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { actualFare, route, duration } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can complete rides'
      });
    }

    // Get ride document
    const rideRef = db.collection('rides').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    const rideData = rideDoc.data();

    // Validate permissions and status
    if (rideData.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You are not assigned to this ride'
      });
    }

    if (rideData.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ride status',
        message: 'Ride must be in progress to be completed'
      });
    }

    // Update ride with completion details
    const completedRideData = {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      actualFare: actualFare || rideData.fare.total,
      actualDuration: duration || null,
      actualRoute: route || null
    };

    await rideRef.update(completedRideData);

    // Create payment record
    const paymentData = {
      rideId,
      userId: rideData.userId,
      driverId: rideData.driverId,
      amount: actualFare || rideData.fare.total,
      currency: 'INR',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      fareBreakdown: rideData.fare
    };

    await db.collection('payments').add(paymentData);

    logger.info(`Ride ${rideId} completed by driver ${driverId}`);

    res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      data: {
        rideId,
        status: 'completed',
        actualFare: paymentData.amount,
        completedAt: paymentData.createdAt
      }
    });

  } catch (error) {
    logger.error('Error completing ride:', error);
    next(error);
  }
});

/**
 * POST /api/rides/:rideId/cancel
 * Cancel a ride
 */
router.post('/:rideId/cancel', authenticate, async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason, cancellationType } = req.body;
    const userId = req.user.uid;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing reason',
        message: 'Cancellation reason is required'
      });
    }

    // Get ride document
    const rideRef = db.collection('rides').doc(rideId);
    const rideDoc = await rideRef.get();

    if (!rideDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
        message: 'The requested ride does not exist'
      });
    }

    const rideData = rideDoc.data();

    // Validate permissions
    if (rideData.userId !== userId && rideData.driverId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to cancel this ride'
      });
    }

    // Validate cancellation timing rules
    const now = new Date();
    const createdAt = rideData.createdAt.toDate();
    const timeDiff = (now - createdAt) / (1000 * 60); // minutes

    let cancellationFee = 0;
    const isUser = rideData.userId === userId;

    // Different cancellation rules based on who is cancelling and when
    if (isUser && timeDiff < 2) {
      cancellationFee = Math.min(rideData.fare.total * 0.1, 50); // 10% or max 50 INR
    } else if (!isUser && rideData.status === 'accepted' && timeDiff > 5) {
      cancellationFee = Math.min(rideData.fare.total * 0.2, 100); // 20% or max 100 INR
    }

    // Update ride status
    await rideRef.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: isUser ? 'user' : 'driver',
      cancellationReason: reason,
      cancellationFee
    });

    // Create cancellation record
    const cancellationData = {
      rideId,
      userId: rideData.userId,
      driverId: rideData.driverId,
      cancelledBy: isUser ? 'user' : 'driver',
      reason,
      cancellationFee,
      createdAt: FieldValue.serverTimestamp()
    };

    await db.collection('cancellations').add(cancellationData);

    logger.info(`Ride ${rideId} cancelled by ${isUser ? 'user' : 'driver'} ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      data: {
        rideId,
        status: 'cancelled',
        cancellationFee,
        cancelledBy: isUser ? 'user' : 'driver'
      }
    });

  } catch (error) {
    logger.error('Error cancelling ride:', error);
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

function calculateFare(distance, vehicleType) {
  const fareStructure = {
    standard: { base: 50, perKm: 15 },
    xl: { base: 80, perKm: 22 },
    premium: { base: 120, perKm: 35 }
  };

  const fare = fareStructure[vehicleType];
  const distanceFare = distance * fare.perKm;
  const total = fare.base + distanceFare;

  return {
    base: fare.base,
    distance: distanceFare,
    total: Math.round(total * 100) / 100
  };
}

async function findNearbyDrivers(latitude, longitude, radiusKm) {
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
          nearbyDrivers.push({
            id: doc.id,
            location: driverData.currentLocation,
            distance: Math.round(distance * 100) / 100,
            vehicleInfo: driverData.vehicleInfo || {},
            rating: driverData.rating || 4.5,
            completedTrips: driverData.completedTrips || 0
          });
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

module.exports = router;