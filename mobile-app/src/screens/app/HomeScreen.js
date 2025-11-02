/**
 * Home Screen
 * Main screen with dual tabs for Quick Ride and Quick Pickup Express
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';
import Geolocation from '@react-native-community/geolocation';
import {useNavigation} from '@react-navigation/native';

const {width} = Dimensions.get('window');

const HomeScreen = () => {
  const [activeTab, setActiveTab] = useState('ride');
  const {user} = useAuth();
  const navigation = useNavigation();

  // Map state
  const [userLocation, setUserLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  const mapRef = useRef(null);

  // Request location permission on component mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

  // Set default pickup location when user location is available
  useEffect(() => {
    if (userLocation && !pickupLocation) {
      setPickupLocation(userLocation);
      setPickupAddress('Current Location');
    }
  }, [userLocation, pickupLocation]);

  // Request location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'Quick Pickup needs access to your location to show nearby rides and deliveries',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setLocationPermission(true);
          getCurrentLocation();
        } else {
          setLocationPermission(false);
          Alert.alert('Permission Denied', 'Location permission is required for better experience');
        }
      } catch (err) {
        console.warn(err);
        setLocationPermission(false);
      }
    } else {
      // iOS permission handling
      Geolocation.requestAuthorization('whenInUse');
      setLocationPermission(true);
      getCurrentLocation();
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const {latitude, longitude} = position.coords;
        setUserLocation({latitude, longitude});

        // Center map on user location
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

  // Handle map press to set pickup/destination
  const handleMapPress = (event) => {
    const {coordinate} = event.nativeEvent;

    if (!pickupLocation) {
      setPickupLocation(coordinate);
      setPickupAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
    } else if (!destinationLocation) {
      setDestinationLocation(coordinate);
      setDestinationAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      // Calculate route (mock implementation)
      calculateRoute(pickupLocation, coordinate);
    } else {
      // Reset both if both are already set
      setPickupLocation(coordinate);
      setDestinationLocation(null);
      setPickupAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      setDestinationAddress('');
      setRouteCoordinates(null);
    }
  };

  // Calculate route (mock implementation - in real app, use Google Directions API)
  const calculateRoute = (pickup, destination) => {
    // Simple straight line for demo
    setRouteCoordinates([pickup, destination]);
  };

  // Handle location input focus
  const handlePickupFocus = () => {
    navigation.navigate('LocationSearch', {
      type: 'pickup',
      onLocationSelected: (location) => {
        setPickupLocation(location.coordinate);
        setPickupAddress(location.address);
      }
    });
  };

  const handleDestinationFocus = () => {
    navigation.navigate('LocationSearch', {
      type: 'destination',
      onLocationSelected: (location) => {
        setDestinationLocation(location.coordinate);
        setDestinationAddress(location.address);
        if (pickupLocation) {
          calculateRoute(pickupLocation, location.coordinate);
        }
      }
    });
  };

  // Handle ride booking
  const handleBookRide = () => {
    if (!pickupLocation || !destinationLocation) {
      Alert.alert('Missing Locations', 'Please select both pickup and destination locations');
      return;
    }

    const bookingData = {
      pickup: {
        coordinate: pickupLocation,
        address: pickupAddress
      },
      destination: {
        coordinate: destinationLocation,
        address: destinationAddress
      },
      vehicleType: 'standard' // Default
    };

    navigation.navigate('RideConfirmation', bookingData);
  };

  // Handle delivery booking
  const handleBookDelivery = () => {
    if (!pickupLocation || !destinationLocation) {
      Alert.alert('Missing Locations', 'Please select both pickup and dropoff locations');
      return;
    }

    const deliveryData = {
      pickup: {
        coordinate: pickupLocation,
        address: pickupAddress
      },
      destination: {
        coordinate: destinationLocation,
        address: destinationAddress
      },
      packageDetails: {
        weight: 1,
        description: 'Standard package'
      }
    };

    navigation.navigate('DeliveryConfirmation', deliveryData);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'User'}!</Text>
          <Text style={styles.subGreeting}>Where would you like to go?</Text>
        </View>
        <TouchableOpacity style={styles.languageToggle}>
          <Text style={styles.languageText}>EN</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ride' && styles.activeTab]}
          onPress={() => setActiveTab('ride')}>
          <Icon
            name="car"
            size={24}
            color={activeTab === 'ride' ? '#FFFFFF' : '#FF6B35'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'ride' && styles.activeTabText,
            ]}>
            Quick Ride
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivery' && styles.activeTab]}
          onPress={() => setActiveTab('delivery')}>
          <Icon
            name="package-variant"
            size={24}
            color={activeTab === 'delivery' ? '#FFFFFF' : '#4CAF50'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'delivery' && styles.activeTabText,
            ]}>
            Quick Pickup Express
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Area - Map and Location Inputs */}
      <View style={styles.content}>
        {/* Location Input Overlay */}
        <View style={styles.locationInputContainer}>
          <TouchableOpacity
            style={[styles.locationInput, pickupLocation && styles.locationInputFilled]}
            onPress={handlePickupFocus}
          >
            <Icon
              name="map-marker"
              size={20}
              color={pickupLocation ? "#4CAF50" : "#999"}
            />
            <TextInput
              style={styles.locationTextInput}
              placeholder="Pickup Location"
              value={pickupAddress}
              editable={false}
              pointerEvents="none"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locationInput, destinationLocation && styles.locationInputFilled]}
            onPress={handleDestinationFocus}
          >
            <Icon
              name="map-marker-radius"
              size={20}
              color={destinationLocation ? "#FF6B35" : "#999"}
            />
            <TextInput
              style={styles.locationTextInput}
              placeholder="Where to?"
              value={destinationAddress}
              editable={false}
              pointerEvents="none"
            />
          </TouchableOpacity>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: userLocation?.latitude || 28.6139,
                longitude: userLocation?.longitude || 77.2090,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              onPress={handleMapPress}
            >
              {/* Pickup Marker */}
              {pickupLocation && (
                <Marker
                  coordinate={pickupLocation}
                  pinColor="#4CAF50"
                  title="Pickup"
                  description={pickupAddress}
                />
              )}

              {/* Destination Marker */}
              {destinationLocation && (
                <Marker
                  coordinate={destinationLocation}
                  pinColor="#FF6B35"
                  title="Destination"
                  description={destinationAddress}
                />
              )}

              {/* Route Polyline */}
              {routeCoordinates && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#FF6B35"
                  strokeWidth={4}
                  lineDashPattern={[10, 5]}
                />
              )}
            </MapView>
          )}

          {/* Current Location Button */}
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={getCurrentLocation}
          >
            <Icon name="crosshairs-gps" size={24} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Booking Button */}
        {pickupLocation && destinationLocation && (
          <View style={styles.bookingButtonContainer}>
            <TouchableOpacity
              style={[
                styles.bookingButton,
                activeTab === 'delivery' && styles.deliveryButton
              ]}
              onPress={activeTab === 'ride' ? handleBookRide : handleBookDelivery}
            >
              <Icon
                name={activeTab === 'ride' ? 'car' : 'package-variant'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.bookingButtonText}>
                {activeTab === 'ride' ? 'Book Quick Ride' : 'Book Delivery'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  languageToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  locationInputContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 8,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 12,
  },
  locationInputFilled: {
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  locationTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
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
  bookingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  bookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  deliveryButton: {
    backgroundColor: '#4CAF50',
  },
  bookingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default HomeScreen;
