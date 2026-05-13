/**
 * AppNavigator
 *
 * Root navigation structure for the Aura Health mobile app. Conditionally
 * renders the Auth stack or the Main tab navigator based on authentication
 * state. Each tab contains its own native stack navigator to enable deep
 * navigation without losing tab context.
 */

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens - Auth
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { BiometricSetupScreen } from '../screens/auth/BiometricSetupScreen';

// Screens - Patient
import { HomeScreen } from '../screens/patient/HomeScreen';
import { AppointmentsScreen } from '../screens/patient/AppointmentsScreen';
import { HealthScreen } from '../screens/patient/HealthScreen';
import { ProfileScreen } from '../screens/patient/ProfileScreen';

// Screens - Triage
import { TriageScreen } from '../screens/triage/TriageScreen';

// Navigation types
import type {
  RootStackParamList,
  AuthStackParamList,
  MainTabParamList,
  HomeStackParamList,
  TriageStackParamList,
  AppointmentsStackParamList,
  HealthStackParamList,
  ProfileStackParamList,
} from './types';

import { Colors } from '../utils/formatters';
import { TabBarIcon } from '../components/ui/TabBarIcon';

// ---------------------------------------------------------------------------
// Stack & Tab Constructors
// ---------------------------------------------------------------------------

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const TriageStack = createNativeStackNavigator<TriageStackParamList>();
const AppointmentsStack = createNativeStackNavigator<AppointmentsStackParamList>();
const HealthStack = createNativeStackNavigator<HealthStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// ---------------------------------------------------------------------------
// Shared screen options
// ---------------------------------------------------------------------------

const commonScreenOptions = {
  headerStyle: {
    backgroundColor: Colors.background,
  },
  headerTintColor: Colors.darkBlue,
  headerTitleStyle: {
    fontWeight: '600' as const,
    fontSize: 18,
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: Colors.background,
  },
};

// ---------------------------------------------------------------------------
// Auth Stack Navigator
// ---------------------------------------------------------------------------

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        ...commonScreenOptions,
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen
        name="BiometricSetup"
        component={BiometricSetupScreen}
        options={{ gestureEnabled: false }}
      />
    </AuthStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Home Tab Stack
// ---------------------------------------------------------------------------

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={commonScreenOptions}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
    </HomeStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Triage Tab Stack
// ---------------------------------------------------------------------------

function TriageNavigator() {
  return (
    <TriageStack.Navigator screenOptions={commonScreenOptions}>
      <TriageStack.Screen
        name="Triage"
        component={TriageScreen}
        options={{
          title: 'Symptom Check',
          headerShown: false,
        }}
      />
    </TriageStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Appointments Tab Stack
// ---------------------------------------------------------------------------

function AppointmentsNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={commonScreenOptions}>
      <AppointmentsStack.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
    </AppointmentsStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Health Tab Stack
// ---------------------------------------------------------------------------

function HealthNavigator() {
  return (
    <HealthStack.Navigator screenOptions={commonScreenOptions}>
      <HealthStack.Screen
        name="Health"
        component={HealthScreen}
        options={{ title: 'Health Data' }}
      />
    </HealthStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Profile Tab Stack
// ---------------------------------------------------------------------------

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={commonScreenOptions}>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </ProfileStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Main Tab Navigator
// ---------------------------------------------------------------------------

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <MainTab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <MainTab.Screen
        name="TriageTab"
        component={TriageNavigator}
        options={{
          title: 'Triage',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="stethoscope" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Symptom triage tab',
        }}
      />
      <MainTab.Screen
        name="AppointmentsTab"
        component={AppointmentsNavigator}
        options={{
          title: 'Appointments',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="calendar" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Appointments tab',
        }}
      />
      <MainTab.Screen
        name="HealthTab"
        component={HealthNavigator}
        options={{
          title: 'Health',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="heart-pulse" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Health data tab',
        }}
      />
      <MainTab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="user" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </MainTab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root App Navigator
// ---------------------------------------------------------------------------

interface AppNavigatorProps {
  isAuthenticated: boolean;
}

export function AppNavigator({ isAuthenticated }: AppNavigatorProps) {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {isAuthenticated ? (
        <RootStack.Screen name="Main" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
