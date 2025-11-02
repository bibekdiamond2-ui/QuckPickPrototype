const express = require('express');
const router = express.Router();
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const { deliveryLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

/**
 * POST /api/deliveries/create
 * Create a new delivery request
 */
router.post('/create', authenticate, deliveryLimiter, async (req, res, next) => {
  try {
    const { pickup, dropoff, packageDetails, deliveryType, scheduledTime } = req.body;
    const senderId = req.user.uid;

    // Validate required fields
    if (!pickup || !dropoff || !packageDetails || !deliveryType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Pickup, dropoff, package details, and delivery type are required'
      });
    }

    // Validate addresses
    if (!pickup.latitude || !pickup.longitude || !dropoff.latitude || !dropoff.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
        message: 'Pickup and dropoff must have valid latitude and longitude'
      });
    }

    // Validate pickup ≠ dropoff
    if (pickup.latitude === dropoff.latitude && pickup.longitude === dropoff.longitude) {
      return res.status(400).json({
        success: false,
        error: 'Same locations',
        message: 'Pickup and dropoff locations must be different'
      });
    }

    // Validate delivery type
    const validDeliveryTypes = ['standard', 'express', 'same_day'];
    if (!validDeliveryTypes.includes(deliveryType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid delivery type',
        message: `Delivery type must be one of: ${validDeliveryTypes.join(', ')}`
      });
    }

    // Validate package details
    if (!packageDetails.weight || !packageDetails.description) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package details',
        message: 'Package weight and description are required'
      });
    }

    // Validate package size and weight limits
    if (packageDetails.weight > 10) { // Max 10kg
      return res.status(400).json({
        success: false,
        error: 'Package too heavy',
        message: 'Maximum package weight is 10kg'
      });
    }

    // Calculate distance and estimated cost
    const distance = calculateDistance(pickup, dropoff);
    const costDetails = calculateDeliveryCost(distance, deliveryType, packageDetails);
    const estimatedTime = calculateDeliveryTime(distance, deliveryType);

    // Create delivery document
    const deliveryData = {
      senderId,
      pickup: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        address: pickup.address || `${pickup.latitude}, ${pickup.longitude}`,
        contactName: pickup.contactName,
        contactPhone: pickup.contactPhone
      },
      dropoff: {
        latitude: dropoff.latitude,
        longitude: dropoff.longitude,
        address: dropoff.address || `${dropoff.latitude}, ${dropoff.longitude}`,
        contactName: dropoff.contactName,
        contactPhone: dropoff.contactPhone
      },
      packageDetails: {
        weight: packageDetails.weight,
        dimensions: packageDetails.dimensions || { length: 0, width: 0, height: 0 },
        description: packageDetails.description,
        specialInstructions: packageDetails.specialInstructions || '',
        value: packageDetails.value || 0
      },
      deliveryType,
      status: 'requesting',
      createdAt: FieldValue.serverTimestamp(),
      scheduledTime: scheduledTime || null,
      cost: {
        base: costDetails.base,
        distance: costDetails.distance,
        weight: costDetails.weight,
        total: costDetails.total,
        currency: 'INR'
      },
      estimatedTime,
      distance
    };

    const deliveryRef = await db.collection('deliveries').add(deliveryData);
    const deliveryDoc = await deliveryRef.get();

    logger.info(`Delivery created: ${deliveryRef.id} by sender ${senderId}`);

    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      data: {
        id: deliveryRef.id,
        ...deliveryDoc.data()
      }
    });

  } catch (error) {
    logger.error('Error creating delivery:', error);
    next(error);
  }
});

/**
 * GET /api/deliveries/:deliveryId/tracking
 * Get real-time delivery tracking information
 */
router.get('/:deliveryId/tracking', authenticate, async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.uid;

    // Get delivery document
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'The requested delivery does not exist'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Validate access permissions
    if (deliveryData.senderId !== userId &&
        deliveryData.receiverId !== userId &&
        deliveryData.driverId !== userId &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to track this delivery'
      });
    }

    let driverLocation = null;
    let driverDetails = null;

    // Get driver location if delivery is assigned
    if (deliveryData.driverId &&
        (deliveryData.status === 'accepted' ||
         deliveryData.status === 'picked_up' ||
         deliveryData.status === 'in_transit')) {
      const driverDoc = await db.collection('drivers').doc(deliveryData.driverId).get();
      if (driverDoc.exists) {
        const driverData = driverDoc.data();
        driverLocation = driverData.currentLocation;

        const userDoc = await db.collection('users').doc(deliveryData.driverId).get();
        driverDetails = userDoc.data();
      }
    }

    // Calculate updated ETA
    let updatedEta = deliveryData.estimatedTime;
    if (driverLocation) {
      if (deliveryData.status === 'accepted') {
        updatedEta = Math.ceil(calculateDistance(driverLocation, deliveryData.pickup) * 2);
      } else if (deliveryData.status === 'picked_up' || deliveryData.status === 'in_transit') {
        updatedEta = Math.ceil(calculateDistance(driverLocation, deliveryData.dropoff) * 2);
      }
    }

    // Get delivery proof if available
    let deliveryProof = null;
    if (deliveryData.status === 'completed' && deliveryData.proofUrl) {
      deliveryProof = deliveryData.proofUrl;
    }

    res.status(200).json({
      success: true,
      data: {
        deliveryId,
        status: deliveryData.status,
        pickup: deliveryData.pickup,
        dropoff: deliveryData.dropoff,
        packageDetails: deliveryData.packageDetails,
        driverLocation,
        driver: driverDetails ? {
          id: deliveryData.driverId,
          name: driverDetails.name || 'Driver',
          phone: driverDetails.phoneNumber,
          rating: driverDetails.rating || 4.5
        } : null,
        estimatedTime: updatedEta,
        cost: deliveryData.cost,
        deliveryProof,
        createdAt: deliveryData.createdAt,
        acceptedAt: deliveryData.acceptedAt,
        pickedUpAt: deliveryData.pickedUpAt,
        completedAt: deliveryData.completedAt,
        timeline: getDeliveryTimeline(deliveryData)
      }
    });

  } catch (error) {
    logger.error('Error getting delivery tracking:', error);
    next(error);
  }
});

/**
 * POST /api/deliveries/:deliveryId/proof-upload
 * Upload delivery proof (driver only)
 */
router.post('/:deliveryId/proof-upload', authenticate, async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { proofType, proofData, timestamp } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can upload delivery proofs'
      });
    }

    if (!proofType || !proofData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Proof type and proof data are required'
      });
    }

    const validProofTypes = ['photo', 'signature', 'qr_code'];
    if (!validProofTypes.includes(proofType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proof type',
        message: `Proof type must be one of: ${validProofTypes.join(', ')}`
      });
    }

    // Get delivery document
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'The requested delivery does not exist'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Validate driver assignment and delivery status
    if (deliveryData.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You are not assigned to this delivery'
      });
    }

    if (!['picked_up', 'in_transit'].includes(deliveryData.status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid delivery status',
        message: 'Delivery proof can only be uploaded after pickup'
      });
    }

    // In a real implementation, you would upload the file to Firebase Storage
    // For now, we'll simulate the upload and store the URL
    const proofUrl = `delivery_proofs/${deliveryId}/${Date.now()}_${proofType}`;

    // Update delivery with proof information
    const proofInfo = {
      type: proofType,
      url: proofUrl,
      data: proofData,
      uploadedAt: FieldValue.serverTimestamp(),
      uploadedBy: driverId
    };

    await deliveryRef.update({
      proof: proofInfo,
      lastUpdated: FieldValue.serverTimestamp()
    });

    logger.info(`Delivery proof uploaded for ${deliveryId} by driver ${driverId}`);

    res.status(200).json({
      success: true,
      message: 'Delivery proof uploaded successfully',
      data: {
        deliveryId,
        proof: proofInfo
      }
    });

  } catch (error) {
    logger.error('Error uploading delivery proof:', error);
    next(error);
  }
});

/**
 * POST /api/deliveries/:deliveryId/confirm-pickup
 * Confirm package pickup (driver only)
 */
router.post('/:deliveryId/confirm-pickup', authenticate, async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { packageCondition, notes, timestamp, location } = req.body;
    const driverId = req.user.uid;

    // Verify user is a driver
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only drivers can confirm package pickup'
      });
    }

    // Get delivery document
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'The requested delivery does not exist'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Validate driver assignment and status
    if (deliveryData.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You are not assigned to this delivery'
      });
    }

    if (deliveryData.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: 'Invalid delivery status',
        message: 'Package can only be picked up after acceptance'
      });
    }

    // Validate location is near pickup location
    if (location) {
      const distanceFromPickup = calculateDistance(location, deliveryData.pickup);
      if (distanceFromPickup > 0.5) { // 500 meters tolerance
        return res.status(400).json({
          success: false,
          error: 'Location too far',
          message: 'You must be at the pickup location to confirm pickup'
        });
      }
    }

    // Update delivery status
    await deliveryRef.update({
      status: 'picked_up',
      pickedUpAt: FieldValue.serverTimestamp(),
      pickupConfirmation: {
        packageCondition: packageCondition || 'good',
        notes: notes || '',
        location: location || null,
        confirmedBy: driverId
      }
    });

    // Notify recipient that package is picked up
    if (deliveryData.receiverId) {
      await createNotification(deliveryData.receiverId, 'package_picked_up', {
        deliveryId,
        estimatedArrival: new Date(Date.now() + deliveryData.estimatedTime * 60 * 1000)
      });
    }

    logger.info(`Package pickup confirmed for delivery ${deliveryId} by driver ${driverId}`);

    res.status(200).json({
      success: true,
      message: 'Package pickup confirmed successfully',
      data: {
        deliveryId,
        status: 'picked_up',
        pickedUpAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error confirming pickup:', error);
    next(error);
  }
});

/**
 * POST /api/deliveries/:deliveryId/confirm-delivery
 * Confirm package delivery (driver or recipient)
 */
router.post('/:deliveryId/confirm-delivery', authenticate, async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { deliveryCondition, recipientSignature, timestamp } = req.body;
    const userId = req.user.uid;

    // Get delivery document
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'The requested delivery does not exist'
      });
    }

    const deliveryData = deliveryDoc.data();

    // Validate permissions and status
    const isDriver = req.user.role === 'driver' && deliveryData.driverId === userId;
    const isRecipient = deliveryData.receiverId === userId;

    if (!isDriver && !isRecipient) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only assigned driver or recipient can confirm delivery'
      });
    }

    if (!['picked_up', 'in_transit'].includes(deliveryData.status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid delivery status',
        message: 'Delivery can only be confirmed after pickup'
      });
    }

    // Check if proof was uploaded (for drivers)
    if (isDriver && !deliveryData.proof) {
      return res.status(400).json({
        success: false,
        error: 'Missing proof',
        message: 'Delivery proof must be uploaded before confirming delivery'
      });
    }

    // Update delivery status
    const completedDeliveryData = {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      deliveryConfirmation: {
        deliveryCondition: deliveryCondition || 'good',
        recipientSignature: recipientSignature || null,
        confirmedBy: isDriver ? 'driver' : 'recipient'
      }
    };

    await deliveryRef.update(completedDeliveryData);

    // Create payment record
    const paymentData = {
      deliveryId,
      senderId: deliveryData.senderId,
      driverId: deliveryData.driverId,
      amount: deliveryData.cost.total,
      currency: 'INR',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      costBreakdown: deliveryData.cost
    };

    await db.collection('payments').add(paymentData);

    logger.info(`Delivery ${deliveryId} completed by ${isDriver ? 'driver' : 'recipient'} ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed successfully',
      data: {
        deliveryId,
        status: 'completed',
        completedAt: paymentData.createdAt
      }
    });

  } catch (error) {
    logger.error('Error confirming delivery:', error);
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

function calculateDeliveryCost(distance, deliveryType, packageDetails) {
  const baseRates = {
    standard: { base: 60, perKm: 20 },
    express: { base: 100, perKm: 35 },
    same_day: { base: 150, perKm: 50 }
  };

  const rates = baseRates[deliveryType];
  const distanceCost = distance * rates.perKm;
  const weightCost = packageDetails.weight > 2 ? (packageDetails.weight - 2) * 10 : 0;
  const total = rates.base + distanceCost + weightCost;

  return {
    base: rates.base,
    distance: distanceCost,
    weight: weightCost,
    total: Math.round(total * 100) / 100
  };
}

function calculateDeliveryTime(distance, deliveryType) {
  const baseTimes = {
    standard: 60, // 60 minutes base
    express: 30,  // 30 minutes base
    same_day: 20  // 20 minutes base
  };

  const baseTime = baseTimes[deliveryType];
  const travelTime = distance * 3; // 3 minutes per km
  return Math.ceil(baseTime + travelTime);
}

function getDeliveryTimeline(deliveryData) {
  const timeline = [
    {
      status: 'requesting',
      title: 'Delivery Requested',
      time: deliveryData.createdAt,
      completed: true
    }
  ];

  if (deliveryData.acceptedAt) {
    timeline.push({
      status: 'accepted',
      title: 'Driver Assigned',
      time: deliveryData.acceptedAt,
      completed: true
    });
  }

  if (deliveryData.pickedUpAt) {
    timeline.push({
      status: 'picked_up',
      title: 'Package Picked Up',
      time: deliveryData.pickedUpAt,
      completed: true
    });
  }

  if (deliveryData.completedAt) {
    timeline.push({
      status: 'completed',
      title: 'Delivered',
      time: deliveryData.completedAt,
      completed: true
    });
  }

  // Add current status if not completed
  if (deliveryData.status !== 'completed') {
    const currentStatusIndex = timeline.findIndex(item => item.status === deliveryData.status);
    if (currentStatusIndex >= 0) {
      timeline[currentStatusIndex].current = true;
    }
  }

  return timeline;
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