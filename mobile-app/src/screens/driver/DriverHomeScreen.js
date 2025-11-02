/**
 * Driver Home Screen
 * Main driver dashboard with availability control and map
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  PermissionsAndroid,
  Platform,
  Switch,
  Animated,
} from 'react-native';
import MapView, {Marker, Circle, PROVIDER_GOOGLE} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';
import {useNavigation} from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';

const {width, height} = Dimensions.get('window');

const DriverHomeScreen = () => {
  const {user} = useAuth();
  const navigation = useNavigation();

  // Driver state
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [tripsCompleted, setTripsCompleted] = useState(0);
  const [onlineHours, setOnlineHours] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const mapRef = useRef(null);

  // Mock driver data
  const driverStats = {
    rating: 4.8,
    acceptanceRate: 85,
    completedTrips: 156,
    totalEarnings: 45230,
  };

  // Mock nearby ride requests
  const mockNearbyRequests = [
    {
      id: 'req1',
      pickup: {
        latitude: 28.6139 + 0.01,
        longitude: 77.2090 + 0.01,
        address: 'Connaught Place, New Delhi',
      },
      destination: {
        latitude: 28.6139 + 0.02,
        longitude: 77.2090 + 0.02,
        address: 'India Gate, New Delhi',
      },
      passenger: {
        name: 'Priya Sharma',
        rating: 4.9,
        trips: 23,
      },
      fare: 150,
      distance: 2.3,
      estimatedTime: 8,
      vehicleType: 'standard',
      requestedAt: new Date(),
    },
    {
      id: 'req2',
      pickup: {
        latitude: 28.6139 - 0.01,
        longitude: 77.2090 - 0.01,
        address: 'Karol Bagh, New Delhi',
      },
      destination: {
        latitude: 28.6139 - 0.02,
        longitude: 77.2090 - 0.02,
        address: 'Rajouri Garden, New Delhi',
      },
      passenger: {
        name: 'Amit Kumar',
        rating: 4.7,
        trips: 45,
      },
      fare: 220,
      distance: 4.1,
      estimatedTime: 12,
      vehicleType: 'xl',
      requestedAt: new Date(),
    },
  ];

  useEffect(() => {
    requestLocationPermission();
    loadDriverStats();
    startPulseAnimation();
  }, []);

  // Start pulsing animation for online status
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'Quick Pickup needs access to your location for ride requests',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
          startLocationTracking();
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      Geolocation.requestAuthorization('whenInUse');
      getCurrentLocation();
      startLocationTracking();
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const {latitude, longitude} = position.coords;
        setCurrentLocation({latitude, longitude});

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 1000);
        }
      },
      (error) => {
        console.error('Location error:', error);
        Alert.alert('Location Error', 'Unable to get your location. Please check your GPS settings.');
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000}
    );
  };

  const startLocationTracking = () => {
    // Update location every 30 seconds when online
    const locationInterval = setInterval(() => {
      if (isOnline) {
        getCurrentLocation();
      }
    }, 30000);

    return () => clearInterval(locationInterval);
  };

  const loadDriverStats = () => {
    // Mock loading driver statistics
    setTodayEarnings(1250);
    setTripsCompleted(8);
    setOnlineHours(4.5);
    setNearbyRequests(mockNearbyRequests);
  };

  const handleAvailabilityToggle = async () => {
    if (!isOnline) {
      // Going online
      if (!currentLocation) {
        Alert.alert('Location Required', 'Please enable location services to go online.');
        return;
      }

      setIsLoading(true);

      try {
        // Mock API call to toggle availability
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsOnline(true);
        setNearbyRequests(mockNearbyRequests);

        // Animate stats panel up
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();

        Alert.alert('Online', 'You are now online and ready to receive ride requests!');
      } catch (error) {
        console.error('Error going online:', error);
        Alert.alert('Error', 'Unable to go online. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Going offline
      setIsLoading(true);

      try {
        // Mock API call to toggle availability
        await new Promise(resolve => setTimeout(resolve, 1000));

        setIsOnline(false);
        setNearbyRequests([]);

        // Animate stats panel down
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }).start();

        Alert.alert('Offline', 'You are now offline and will not receive ride requests.');
      } catch (error) {
        console.error('Error going offline:', error);
        Alert.alert('Error', 'Unable to go offline. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRideRequest = (request) => {
    navigation.navigate('RideRequest', {request});
  };

  const renderStatsCard = () => (
    <Animated.View
      style={[
        styles.statsCard,
        {
          transform: [{translateY: slideAnim}],
        },
      ]}
    >
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>₹{todayEarnings}</Text>
          <Text style={styles.statLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tripsCompleted}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{onlineHours}h</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        <View style={styles.quickStat}>
          <Icon name="star" size={16} color="#FFD700" />
          <Text style={styles.quickStatText}>{driverStats.rating}</Text>
        </View>
        <View style={styles.quickStat}>
          <Icon name="check-circle" size={16} color="#4CAF50" />
          <Text style={styles.quickStatText}>{driverStats.acceptanceRate}%</Text>
        </View>
        <View style={styles.quickStat}>
          <Icon name="car" size={16} color="#FF6B35" />
          <Text style={styles.quickStatText}>{driverStats.completedTrips}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderRideRequest = (request) => (
    <TouchableOpacity
      key={request.id}
      style={styles.requestCard}
      onPress={() => handleRideRequest(request)}
    >
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={styles.requestFare}>₹{request.fare}</Text>
          <Text style={styles.requestDistance}>{request.distance} km • {request.estimatedTime} min</Text>
        </View>
        <View style={[styles.requestType, request.vehicleType === 'xl' && styles.requestTypeXL]}>
          <Icon
            name={request.vehicleType === 'xl' ? 'car-estate' : 'car'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.requestTypeText}>
            {request.vehicleType === 'xl' ? 'XL' : 'Standard'}
          </Text>
        </View>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.routePoint}>
          <Icon name="map-marker" size={16} color="#4CAF50" />
          <Text style={styles.routeText} numberOfLines={1}>
            {request.pickup.address}
          </Text>
        </View>
        <Icon name="arrow-down" size={16} color="#999999" />
        <View style={styles.routePoint}>
          <Icon name="map-marker-radius" size={16} color="#FF6B35" />
          <Text style={styles.routeText} numberOfLines={1}>
            {request.destination.address}
          </Text>
        </View>
      </View>

      <View style={styles.passengerInfo}>
        <Icon name="account" size={20} color="#666666" />
        <Text style={styles.passengerName}>{request.passenger.name}</Text>
        <View style={styles.passengerRating}>
          <Icon name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{request.passenger.rating}</Text>
        </View>
        <Text style={styles.tripsText}>({request.passenger.trips} trips)</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'Driver'}!</Text>
          <Text style={styles.subGreeting}>
            {isOnline ? 'You\'re online and ready to receive requests' : 'Go online to start earning'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => Alert.alert('Notifications', 'No new notifications')}
        >
          <Icon name="bell" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: currentLocation?.latitude || 28.6139,
            longitude: currentLocation?.longitude || 77.2090,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          {/* Driver location circle when online */}
          {currentLocation && isOnline && (
            <>
              <Circle
                center={currentLocation}
                radius={500} // 500m service area
                strokeColor="#4CAF50"
                strokeWidth={2}
                fillColor="rgba(76, 175, 80, 0.1)"
              />
              <Circle
                center={currentLocation}
                radius={200} // 200m immediate area
                strokeColor="#FF6B35"
                strokeWidth={2}
                fillColor="rgba(255, 107, 53, 0.1)"
              />
            </>
          )}

          {/* Nearby ride requests */}
          {nearbyRequests.map(request => (
            <Marker
              key={request.id}
              coordinate={request.pickup}
              title={`₹${request.fare} • ${request.distance}km`}
              description={request.pickup.address}
              pinColor="#FF6B35"
            />
          ))}
        </MapView>

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
        >
          <Icon name="crosshairs-gps" size={24} color="#FF6B35" />
        </TouchableOpacity>

        {/* Online Status Indicator */}
        <Animated.View
          style={[
            styles.onlineIndicator,
            {
              transform: [{scale: pulseAnim}],
              backgroundColor: isOnline ? '#4CAF50' : '#999999',
            },
          ]}
        >
          <Icon
            name={isOnline ? 'car' : 'car-off'}
            size={24}
            color="#FFFFFF"
          />
        </Animated.View>
      </View>

      {/* Stats Card (shown when online) */}
      {isOnline && renderStatsCard()}

      {/* Availability Toggle */}
      <View style={styles.availabilityContainer}>
        <View style={styles.availabilityContent}>
          <View style={styles.availabilityInfo}>
            <Text style={styles.availabilityTitle}>
              {isOnline ? 'You\'re Online' : 'You\'re Offline'}
            </Text>
            <Text style={styles.availabilitySubtitle}>
              {isOnline
                ? 'Receiving ride requests in your area'
                : 'Toggle the switch to go online and start earning'
              }
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              isOnline ? styles.toggleButtonOnline : styles.toggleButtonOffline,
              isLoading && styles.toggleButtonDisabled,
            ]}
            onPress={handleAvailabilityToggle}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.toggleButtonText}>Loading...</Text>
            ) : (
              <Text style={styles.toggleButtonText}>
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Nearby Requests */}
      {nearbyRequests.length > 0 && (
        <View style={styles.requestsContainer}>
          <Text style={styles.requestsTitle}>
            Nearby Requests ({nearbyRequests.length})
          </Text>
          {nearbyRequests.map(renderRideRequest)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  onlineIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  statsCard: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  availabilityContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  availabilityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityInfo: {
    flex: 1,
  },
  availabilityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  availabilitySubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  toggleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  toggleButtonOnline: {
    backgroundColor: '#F44336',
  },
  toggleButtonOffline: {
    backgroundColor: '#4CAF50',
  },
  toggleButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  requestsContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight: 300,
  },
  requestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  requestDistance: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  requestType: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  requestTypeXL: {
    backgroundColor: '#9C27B0',
  },
  requestTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  routeInfo: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  passengerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666666',
  },
  tripsText: {
    fontSize: 12,
    color: '#999999',
  },
});

export default DriverHomeScreen;