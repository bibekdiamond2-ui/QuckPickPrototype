/**
 * Ride Confirmation Screen
 * Shows ride details and allows confirmation with vehicle selection
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';
import {useRoute, useNavigation} from '@react-navigation/native';

const {width, height} = Dimensions.get('window');

const RideConfirmationScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const {user} = useAuth();

  const {pickup, destination, vehicleType: initialVehicleType = 'standard'} = route.params || {};

  const [selectedVehicleType, setSelectedVehicleType] = useState(initialVehicleType);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [eta, setEta] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Vehicle types configuration
  const vehicleTypes = {
    standard: {
      name: 'Quick Ride',
      description: 'Affordable, everyday rides',
      icon: 'car',
      baseFare: 50,
      perKm: 15,
      capacity: 4,
      timeMultiplier: 1,
    },
    xl: {
      name: 'Quick Ride XL',
      description: 'For groups up to 6',
      icon: 'car-estate',
      baseFare: 80,
      perKm: 22,
      capacity: 6,
      timeMultiplier: 1.1,
    },
    premium: {
      name: 'Quick Ride Premium',
      description: 'High-end, comfortable rides',
      icon: 'car-sports',
      baseFare: 120,
      perKm: 35,
      capacity: 4,
      timeMultiplier: 0.9,
    },
  };

  // Calculate fare and ETA on component mount
  useEffect(() => {
    calculateRideDetails();
    fetchNearbyDrivers();
  }, [selectedVehicleType, pickup, destination]);

  const calculateRideDetails = () => {
    const distance = calculateDistance(pickup.coordinate, destination.coordinate);
    const vehicle = vehicleTypes[selectedVehicleType];

    const baseFare = vehicle.baseFare;
    const distanceFare = distance * vehicle.perKm;
    const totalFare = baseFare + distanceFare;

    const estimatedTime = Math.ceil(distance * 3 * vehicle.timeMultiplier); // 3 min per km base

    setFareEstimate({
      base: baseFare,
      distance: distanceFare,
      total: Math.round(totalFare),
      distance: Math.round(distance * 100) / 100,
    });

    setEta(estimatedTime);
  };

  const fetchNearbyDrivers = async () => {
    // Mock implementation - in real app, call API
    const mockDrivers = [
      {
        id: 'driver1',
        name: 'Raj Kumar',
        rating: 4.8,
        vehicle: 'Honda City',
        plateNumber: 'DL 01 AB 1234',
        distance: 2.3,
        estimatedArrival: 5,
      },
      {
        id: 'driver2',
        name: 'Amit Singh',
        rating: 4.6,
        vehicle: 'Maruti Suzuki',
        plateNumber: 'DL 02 CD 5678',
        distance: 3.1,
        estimatedArrival: 7,
      },
    ];

    setNearbyDrivers(mockDrivers);
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

  const handleVehicleSelect = (vehicleType) => {
    setSelectedVehicleType(vehicleType);
  };

  const handleConfirmRide = async () => {
    if (!fareEstimate || !eta) {
      Alert.alert('Error', 'Unable to calculate ride details. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Mock API call to create ride
      const rideData = {
        pickup: {
          latitude: pickup.coordinate.latitude,
          longitude: pickup.coordinate.longitude,
          address: pickup.address,
        },
        destination: {
          latitude: destination.coordinate.latitude,
          longitude: destination.coordinate.longitude,
          address: destination.address,
        },
        vehicleType: selectedVehicleType,
        fare: {
          base: fareEstimate.base,
          distance: fareEstimate.distance,
          total: fareEstimate.total,
          currency: 'INR',
        },
        estimatedTime: eta,
        distance: fareEstimate.distance,
      };

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to live tracking screen
      navigation.navigate('LiveTracking', {
        rideId: 'mock_ride_id', // In real app, this comes from API
        rideData,
      });

    } catch (error) {
      console.error('Error creating ride:', error);
      Alert.alert('Error', 'Unable to create ride. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderVehicleOption = (type, vehicle) => (
    <TouchableOpacity
      key={type}
      style={[
        styles.vehicleOption,
        selectedVehicleType === type && styles.selectedVehicleOption,
      ]}
      onPress={() => handleVehicleSelect(type)}
    >
      <View style={styles.vehicleInfo}>
        <View style={styles.vehicleHeader}>
          <Icon
            name={vehicle.icon}
            size={24}
            color={selectedVehicleType === type ? '#FF6B35' : '#666'}
          />
          <View style={styles.vehicleDetails}>
            <Text style={[
              styles.vehicleName,
              selectedVehicleType === type && styles.selectedVehicleName,
            ]}>
              {vehicle.name}
            </Text>
            <Text style={styles.vehicleDescription}>
              {vehicle.description}
            </Text>
          </View>
        </View>
        <View style={styles.vehicleSpecs}>
          <Text style={styles.vehicleSpec}>• {vehicle.capacity} seats</Text>
        </View>
      </View>

      <View style={styles.vehiclePricing}>
        <Text style={[
          styles.vehiclePrice,
          selectedVehicleType === type && styles.selectedVehiclePrice,
        ]}>
          ₹{fareEstimate ? fareEstimate.total : '---'}
        </Text>
        <Text style={styles.etaText}>{eta} min</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Ride</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: (pickup.coordinate.latitude + destination.coordinate.latitude) / 2,
              longitude: (pickup.coordinate.longitude + destination.coordinate.longitude) / 2,
              latitudeDelta: Math.abs(pickup.coordinate.latitude - destination.coordinate.latitude) * 1.5,
              longitudeDelta: Math.abs(pickup.coordinate.longitude - destination.coordinate.longitude) * 1.5,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={pickup.coordinate} pinColor="#4CAF50" />
            <Marker coordinate={destination.coordinate} pinColor="#FF6B35" />
            <Polyline
              coordinates={[pickup.coordinate, destination.coordinate]}
              strokeColor="#FF6B35"
              strokeWidth={4}
              lineDashPattern={[10, 5]}
            />
          </MapView>
        </View>

        {/* Location Details */}
        <View style={styles.locationDetails}>
          <View style={styles.locationRow}>
            <Icon name="map-marker" size={20} color="#4CAF50" />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Pickup</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {pickup.address}
              </Text>
            </View>
          </View>

          <View style={styles.locationDivider} />

          <View style={styles.locationRow}>
            <Icon name="map-marker-radius" size={20} color="#FF6B35" />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Destination</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {destination.address}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle Selection */}
        <View style={styles.vehicleSelection}>
          <Text style={styles.sectionTitle}>Choose Vehicle</Text>
          {Object.entries(vehicleTypes).map(([type, vehicle]) =>
            renderVehicleOption(type, vehicle)
          )}
        </View>

        {/* Trip Details */}
        {fareEstimate && (
          <View style={styles.tripDetails}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distance</Text>
              <Text style={styles.detailValue}>{fareEstimate.distance} km</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Time</Text>
              <Text style={styles.detailValue}>{eta} minutes</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Base Fare</Text>
              <Text style={styles.detailValue}>₹{fareEstimate.base}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distance Fare</Text>
              <Text style={styles.detailValue}>₹{fareEstimate.distance}</Text>
            </View>
            <View style={[styles.detailRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Fare</Text>
              <Text style={styles.totalValue}>₹{fareEstimate.total}</Text>
            </View>
          </View>
        )}

        {/* Driver Availability */}
        {nearbyDrivers.length > 0 && (
          <View style={styles.driverAvailability}>
            <Text style={styles.sectionTitle}>Nearby Drivers</Text>
            <Text style={styles.driversInfo}>
              {nearbyDrivers.length} drivers nearby • Arriving in {nearbyDrivers[0].estimatedArrival} min
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.confirmButtonContainer}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmRide}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Icon name="check" size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                Confirm {vehicleTypes[selectedVehicleType].name}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  locationDetails: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  locationDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  vehicleSelection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  selectedVehicleOption: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF8F5',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  selectedVehicleName: {
    color: '#FF6B35',
  },
  vehicleDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  vehicleSpecs: {
    marginTop: 4,
  },
  vehicleSpec: {
    fontSize: 12,
    color: '#999999',
  },
  vehiclePricing: {
    alignItems: 'flex-end',
  },
  vehiclePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  selectedVehiclePrice: {
    color: '#FF6B35',
  },
  etaText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  tripDetails: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666666',
  },
  detailValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  driverAvailability: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  driversInfo: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  bottomSpacer: {
    height: 100,
  },
  confirmButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default RideConfirmationScreen;