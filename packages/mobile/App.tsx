/**
 * Aura Health - Root Application Component
 *
 * Initializes core providers: React Navigation, React Query, auth state
 * management, and splash screen handling. The app determines the initial
 * route based on stored authentication tokens and biometric enrollment
 * status via expo-secure-store.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/authStore';
import { notificationService } from './src/services/notifications';
import { offlineService } from './src/services/offline';
import { Colors } from './src/utils/formatters';

// Prevent auto-hide so we control when splash goes away
SplashScreen.preventAutoHideAsync();

/**
 * React Query client with sensible defaults for a mobile healthcare app.
 * - Stale time of 5 minutes to reduce unnecessary refetches.
 * - Retry with exponential backoff (max 2 retries) for resilient connectivity.
 * - gcTime of 30 minutes to retain cached data across navigation.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Linking configuration for deep links into the Aura Health app.
 * Supports direct navigation to triage results, appointments, and
 * health data views from push notifications and external links.
 */
const linking = {
  prefixes: ['aurahealth://', 'https://app.aurahealth.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      Main: {
        screens: {
          HomeTab: {
            screens: {
              Home: 'home',
            },
          },
          TriageTab: {
            screens: {
              Triage: 'triage',
            },
          },
          AppointmentsTab: {
            screens: {
              Appointments: 'appointments',
            },
          },
          HealthTab: {
            screens: {
              Health: 'health',
            },
          },
          ProfileTab: {
            screens: {
              Profile: 'profile',
            },
          },
        },
      },
    },
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Attempt to restore a previous session from secure storage
        await restoreSession();
      } catch (error) {
        // Session restoration failure is non-fatal; user will be
        // directed to the login screen.
        console.warn('Session restoration failed:', error);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, [restoreSession]);

  // Initialize core services on mount
  useEffect(() => {
    notificationService.initialize().catch((err) => {
      console.warn('Notification service initialization failed:', err);
    });
    offlineService.initialize().catch((err) => {
      console.warn('Offline service initialization failed:', err);
    });

    return () => {
      notificationService.destroy();
      offlineService.destroy();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      // Hide splash screen once auth state is determined
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
          translucent={false}
        />
        <NavigationContainer linking={linking}>
          <View style={styles.root} onLayout={onLayoutRootView}>
            <AppNavigator isAuthenticated={isAuthenticated} />
          </View>
        </NavigationContainer>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
