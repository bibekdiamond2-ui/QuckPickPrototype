/**
 * Main App Navigator
 * Role-based navigation for passengers and drivers
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../context/AuthContext';
import HomeScreen from '../screens/app/HomeScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import TripHistoryScreen from '../screens/app/TripHistoryScreen';
import RideConfirmationScreen from '../screens/app/RideConfirmationScreen';
import LiveTrackingScreen from '../screens/app/LiveTrackingScreen';

// Driver screens (to be created)
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack navigator for passenger screens
const PassengerStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="RideConfirmation" component={RideConfirmationScreen} />
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
      {/* Additional passenger screens will be added as needed */}
    </Stack.Navigator>
  );
};

// Stack navigator for driver screens
const DriverStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      {/* Additional driver screens will be added as needed */}
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const {user} = useAuth();

  // Check if user has driver role
  const isDriver = user?.role === 'driver';

  if (isDriver) {
    // Driver navigation
    return (
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarIcon: ({focused, color, size}) => {
            let iconName;

            if (route.name === 'DriverHomeTab') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Earnings') {
              iconName = focused ? 'currency-inr' : 'currency-inr';
            } else if (route.name === 'DriverHistory') {
              iconName = focused ? 'history' : 'history';
            } else if (route.name === 'DriverProfile') {
              iconName = focused ? 'account' : 'account-outline';
            }

            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF6B35',
          tabBarInactiveTintColor: '#999999',
          tabBarStyle: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        })}>
        <Tab.Screen
          name="DriverHomeTab"
          component={DriverStack}
          options={{
            tabBarLabel: 'Home',
          }}
        />
        <Tab.Screen
          name="Earnings"
          component={EarningsScreen}
          options={{
            tabBarLabel: 'Earnings',
          }}
        />
        <Tab.Screen
          name="DriverHistory"
          component={TripHistoryScreen}
          options={{
            tabBarLabel: 'History',
          }}
        />
        <Tab.Screen
          name="DriverProfile"
          component={DriverProfileScreen}
          options={{
            tabBarLabel: 'Profile',
          }}
        />
      </Tab.Navigator>
    );
  }

  // Regular passenger navigation (existing)
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color, size}) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'history' : 'history';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}>
      <Tab.Screen
        name="HomeTab"
        component={PassengerStack}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="History"
        component={TripHistoryScreen}
        options={{
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
