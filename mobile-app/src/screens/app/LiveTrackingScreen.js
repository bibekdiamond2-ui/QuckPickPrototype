/**
 * Live Tracking Screen
 * Real-time ride tracking for passengers
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  Share,
  Animated,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE, Circle} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';
import {useRoute, useNavigation} from '@react-navigation/native';

const {width, height} = Dimensions.get('window');

const LiveTrackingScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const {user} = useAuth();

  const {rideId, rideData} = route.params || {};

  const [driverLocation, setDriverLocation] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [rideStatus, setRideStatus] = useState('confirmed');
  const [eta, setEta] = useState(10);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Animation for status updates
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Mock driver data
  const mockDriverInfo = {
    id: 'driver123',
    name: 'Raj Kumar',
    phone: '+91 98765 43210',
    rating: 4.8,
    vehicle: {
      make: 'Honda',
      model: 'City',
      color: 'White',
      licensePlate: 'DL 01 AB 1234',
    },
    photo: 'https://picsum.photos/seed/driver123/200/200',
  };

  useEffect(() => {
    // Initialize screen
    initializeTracking();

    // Set up real-time tracking simulation
    const trackingInterval = setInterval(updateDriverLocation, 3000); // Update every 3 seconds

    return () => {
      clearInterval(trackingInterval);
    };
  }, []);

  const initializeTracking = () => {
    setDriverInfo(mockDriverInfo);
    setRideStatus('confirmed');

    // Initial driver location (2km away from pickup)
    const initialDriverLocation = {
      latitude: rideData.pickup.latitude + 0.01,
      longitude: rideData.pickup.longitude + 0.01,
    };
    setDriverLocation(initialDriverLocation);

    // Set initial route
    const initialRoute = [
      initialDriverLocation,
      rideData.pickup,
      rideData.destination,
    ];
    setRouteCoordinates(initialRoute);

    // Animate status appearance
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const updateDriverLocation = () => {
    // Simulate driver movement towards pickup
    if (driverLocation && rideStatus === 'confirmed') {
      const newLocation = {
        latitude: driverLocation.latitude - 0.002,
        longitude: driverLocation.longitude - 0.002,
      };
      setDriverLocation(newLocation);

      // Update ETA
      const distance = calculateDistance(newLocation, rideData.pickup);
      const newEta = Math.ceil(distance * 3); // 3 min per km
      setEta(Math.max(1, newEta));

      // Check if driver arrived
      if (distance < 0.1) {
        setRideStatus('arrived');
        Alert.alert('Driver Arrived', 'Your driver has arrived at the pickup location.');
      }

      // Update route
      const updatedRoute = [
        newLocation,
        rideData.pickup,
        rideData.destination,
      ];
      setRouteCoordinates(updatedRoute);
    } else if (rideStatus === 'arrived') {
      // Simulate trip to destination
      setRideStatus('in_progress');
      setEta(15); // Reset ETA for destination
    } else if (rideStatus === 'in_progress') {
      // Simulate movement towards destination
      const currentLocation = driverLocation || rideData.pickup;
      const newLocation = {
        latitude: currentLocation.latitude - 0.001,
        longitude: currentLocation.longitude - 0.001,
      };
      setDriverLocation(newLocation);

      const distance = calculateDistance(newLocation, rideData.destination);
      const newEta = Math.ceil(distance * 3);
      setEta(Math.max(1, newEta));

      // Update route for trip
      const tripRoute = [
        newLocation,
        rideData.destination,
      ];
      setRouteCoordinates(tripRoute);

      // Check if arrived at destination
      if (distance < 0.1) {
        setRideStatus('completed');
        clearInterval(intervalId);
        showCompletionDialog();
      }
    }
  };

  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  const showCompletionDialog = () => {
    Alert.alert(
      'Trip Completed',
      'Thank you for riding with Quick Pickup!',
      [
        {
          text: 'Rate Driver',
          onPress: () => navigation.navigate('DriverRating', {driverId: mockDriverInfo.id}),
        },
        {
          text: 'Home',
          onPress: () => navigation.navigate('Home'),
          style: 'default',
        },
      ]
    );
  };

  const handleCallDriver = () => {
    Alert.alert(
      'Call Driver',
      `Would you like to call ${driverInfo.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${driverInfo.phone}`),
        },
      ]
    );
  };

  const handleMessageDriver = () => {
    Alert.alert('Message Driver', 'This feature will open the messaging app to contact your driver.');
  };

  const handleShareTrip = async () => {
    try {
      const shareMessage = `I'm on a Quick Pickup ride!\n\nStatus: ${getStatusLabel(rideStatus)}\nETA: ${eta} minutes\n\nTrack my trip live!`;
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.error('Error sharing trip:', error);
    }
  };

  const handleEmergencySOS = () => {
    Alert.alert(
      'Emergency SOS',
      'This will alert emergency services and share your location. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: () => {
            // In a real app, this would trigger emergency protocols
            Alert.alert('SOS Sent', 'Emergency services have been alerted with your location.');
          },
        },
      ]
    );
  };

  const handleCancelRide = () => {
    if (rideStatus === 'in_progress') {
      Alert.alert('Cannot Cancel', 'You cannot cancel a ride that is in progress.');
      return;
    }

    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? Cancellation fees may apply.',
      [
        {
          text: 'Keep Ride',
          style: 'cancel',
        },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('Home');
          },
        },
      ]
    );
  };

  const getStatusLabel = (status) => {
    const statusLabels = {
      confirmed: 'Driver Confirmed',
      on_the_way: 'On The Way',
      arrived: 'Driver Arrived',
      in_progress: 'En Route',
      completed: 'Completed',
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status) => {
    const statusColors = {
      confirmed: '#4CAF50',
      on_the_way: '#2196F3',
      arrived: '#FF9800',
      in_progress: '#9C27B0',
      completed: '#4CAF50',
    };
    return statusColors[status] || '#666666';
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      confirmed: 'check-circle',
      on_the_way: 'car',
      arrived: 'map-marker',
      in_progress: 'navigation',
      completed: 'flag-checkered',
    };
    return statusIcons[status] || 'information';
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: (driverLocation?.latitude || rideData.pickup.latitude),
          longitude: (driverLocation?.longitude || rideData.pickup.longitude),
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Pickup Location */}
        <Marker
          coordinate={rideData.pickup}
          pinColor="#4CAF50"
          title="Pickup"
          description={rideData.pickup.address}
        />

        {/* Destination */}
        <Marker
          coordinate={rideData.destination}
          pinColor="#FF6B35"
          title="Destination"
          description={rideData.destination.address}
        />

        {/* Driver Location */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title={driverInfo?.name || 'Driver'}
            description={`${driverInfo?.vehicle.make} ${driverInfo?.vehicle.model}`}
          >
            <View style={styles.driverMarker}>
              <Icon name="car" size={24} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Route */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#FF6B35"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* Driver location circle */}
        {driverLocation && rideStatus === 'arrived' && (
          <Circle
            center={driverLocation}
            radius={100}
            strokeColor="#4CAF50"
            strokeWidth={2}
            fillColor="rgba(76, 175, 80, 0.2)"
          />
        )}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Animated.View style={[styles.statusContainer, {opacity: fadeAnim}]}>
          <Icon
            name={getStatusIcon(rideStatus)}
            size={20}
            color={getStatusColor(rideStatus)}
          />
          <Text style={[styles.statusText, {color: getStatusColor(rideStatus)}]}>
            {getStatusLabel(rideStatus)}
          </Text>
        </Animated.View>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareTrip}
        >
          <Icon name="share" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Driver Info */}
        {driverInfo && (
          <View style={styles.driverInfo}>
            <View style={styles.driverHeader}>
              <View style={styles.driverAvatar}>
                <Icon name="account" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                <View style={styles.driverMeta}>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>{driverInfo.rating}</Text>
                  </View>
                  <Text style={styles.vehicleText}>
                    {driverInfo.vehicle.color} {driverInfo.vehicle.make} {driverInfo.vehicle.model}
                  </Text>
                  <Text style={styles.plateText}>{driverInfo.vehicle.licensePlate}</Text>
                </View>
              </View>
            </View>

            <View style={styles.communicationButtons}>
              <TouchableOpacity
                style={styles.commButton}
                onPress={handleCallDriver}
              >
                <Icon name="phone" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commButton}
                onPress={handleMessageDriver}
              >
                <Icon name="message" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Trip Progress */}
        <View style={styles.tripProgress}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Trip Progress</Text>
            <View style={styles.etaContainer}>
              <Icon name="clock" size={16} color="#FF6B35" />
              <Text style={styles.etaText}>{eta} min</Text>
            </View>
          </View>

          <View style={styles.progressSteps}>
            <View style={styles.progressStep}>
              <View style={[styles.stepIcon, {backgroundColor: '#4CAF50'}]}>
                <Icon name="map-marker" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.stepLabel}>Pickup</Text>
              <Text style={styles.stepAddress}>{rideData.pickup.address}</Text>
            </View>

            <View style={styles.progressConnector} />

            <View style={[
              styles.progressStep,
              rideStatus === 'completed' && {opacity: 1}
            ]}>
              <View style={[
                styles.stepIcon,
                {backgroundColor: rideStatus === 'completed' ? '#FF6B35' : '#E0E0E0'}
              ]}>
                <Icon name="flag-checkered" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.stepLabel}>Destination</Text>
              <Text style={styles.stepAddress}>{rideData.destination.address}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.emergencyButton]}
            onPress={handleEmergencySOS}
          >
            <Icon name="phone-in-talk" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Emergency SOS</Text>
          </TouchableOpacity>

          {rideStatus !== 'in_progress' && rideStatus !== 'completed' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelRide}
            >
              <Icon name="cancel" size={20} color="#FF6B35" />
              <Text style={[styles.actionButtonText, {color: '#FF6B35'}]}>
                Cancel Ride
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  driverMeta: {
    gap: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  vehicleText: {
    fontSize: 14,
    color: '#666666',
  },
  plateText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '600',
  },
  communicationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  commButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripProgress: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  etaText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepAddress: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginTop: 16,
    marginHorizontal: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emergencyButton: {
    backgroundColor: '#F44336',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default LiveTrackingScreen;