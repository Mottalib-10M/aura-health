/**
 * AppNavigator
 *
 * Root navigation structure for the Aura Health mobile app. Conditionally
 * renders the Auth stack or the Main tab navigator based on authentication
 * state. Each tab contains its own native stack navigator to enable deep
 * navigation without losing tab context.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
// Placeholder Screen (for not-yet-implemented sub-screens)
// ---------------------------------------------------------------------------

function PlaceholderScreen({ navigation, route }: { navigation: any; route: any }) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.title}>Coming Soon</Text>
      <Text style={placeholderStyles.subtitle}>
        This screen is under development.
      </Text>
      <Pressable
        style={placeholderStyles.backButton}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={placeholderStyles.backButtonText}>Go Back</Text>
      </Pressable>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.darkBlue,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  backButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
});

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
      <HomeStack.Screen
        name="Notifications"
        component={PlaceholderScreen}
        options={{ title: 'Notifications' }}
      />
      <HomeStack.Screen
        name="AlertDetail"
        component={PlaceholderScreen}
        options={{ title: 'Alert Detail' }}
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
      <TriageStack.Screen
        name="TriageResults"
        component={PlaceholderScreen}
        options={{ title: 'Triage Results' }}
      />
      <TriageStack.Screen
        name="BookFromTriage"
        component={PlaceholderScreen}
        options={{ title: 'Book Appointment' }}
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
      <AppointmentsStack.Screen
        name="AppointmentDetail"
        component={PlaceholderScreen}
        options={{ title: 'Appointment Detail' }}
      />
      <AppointmentsStack.Screen
        name="BookAppointment"
        component={PlaceholderScreen}
        options={{ title: 'Book Appointment' }}
      />
      <AppointmentsStack.Screen
        name="DoctorProfile"
        component={PlaceholderScreen}
        options={{ title: 'Doctor Profile' }}
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
      <HealthStack.Screen
        name="MetricDetail"
        component={PlaceholderScreen}
        options={{ title: 'Metric Detail' }}
      />
      <HealthStack.Screen
        name="ConnectWearable"
        component={PlaceholderScreen}
        options={{ title: 'Connect Wearable' }}
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
      <ProfileStack.Screen
        name="EditProfile"
        component={PlaceholderScreen}
        options={{ title: 'Edit Profile' }}
      />
      <ProfileStack.Screen
        name="MedicalHistory"
        component={PlaceholderScreen}
        options={{ title: 'Medical History' }}
      />
      <ProfileStack.Screen
        name="ConnectedDevices"
        component={PlaceholderScreen}
        options={{ title: 'Connected Devices' }}
      />
      <ProfileStack.Screen
        name="PrescriptionHistory"
        component={PlaceholderScreen}
        options={{ title: 'Prescription History' }}
      />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={PlaceholderScreen}
        options={{ title: 'Notification Preferences' }}
      />
      <ProfileStack.Screen
        name="LanguageSettings"
        component={PlaceholderScreen}
        options={{ title: 'Language' }}
      />
      <ProfileStack.Screen
        name="DataSharingSettings"
        component={PlaceholderScreen}
        options={{ title: 'Data Sharing' }}
      />
      <ProfileStack.Screen
        name="About"
        component={PlaceholderScreen}
        options={{ title: 'About Aura Health' }}
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
