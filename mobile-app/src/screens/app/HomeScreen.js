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

      {/* Content Area - Map will go here in Phase 2 */}
      <View style={styles.content}>
        <View style={styles.placeholderContainer}>
          <Icon
            name={activeTab === 'ride' ? 'map-marker' : 'package-variant'}
            size={80}
            color="#E0E0E0"
          />
          <Text style={styles.placeholderText}>
            {activeTab === 'ride'
              ? 'Ride booking coming soon!'
              : 'Delivery service coming soon!'}
          </Text>
          <Text style={styles.placeholderSubtext}>
            Map view and booking functionality will be added in Phase 2
          </Text>
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
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999999',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;
