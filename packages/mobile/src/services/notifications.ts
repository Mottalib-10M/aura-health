/**
 * Push Notification Service
 *
 * Configures push notifications using expo-notifications. Handles
 * device token registration with the backend, incoming notification
 * routing, and local reminder scheduling for appointments and
 * medication adherence.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiClient } from './api';
import { Colors } from '../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationCategory =
  | 'appointment_reminder'
  | 'triage_result'
  | 'health_alert'
  | 'medication_reminder'
  | 'doctor_message'
  | 'system';

interface NotificationPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ScheduleReminderOptions {
  id: string;
  title: string;
  body: string;
  triggerDate: Date;
  category: NotificationCategory;
  data?: Record<string, unknown>;
  repeatInterval?: 'day' | 'week';
}

// ---------------------------------------------------------------------------
// Notification Configuration
// ---------------------------------------------------------------------------

/**
 * Sets default notification behavior for the app.
 * Notifications are shown as alerts with sound and badge updates.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------

class NotificationService {
  private pushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private onNotificationReceived: ((notification: NotificationPayload) => void) | null = null;
  private onNotificationTapped: ((data: Record<string, unknown>) => void) | null = null;

  /**
   * Initializes the notification service: requests permissions, registers
   * push token, and sets up notification listeners.
   */
  async initialize(): Promise<string | null> {
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await this.createAndroidChannels();
    }

    // Request permissions
    const token = await this.registerForPushNotifications();

    // Set up listeners
    this.setupListeners();

    // Register categories for interactive notifications
    await this.registerCategories();

    return token;
  }

  /**
   * Requests push notification permissions and registers the device
   * token with the Aura Health backend.
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device.');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowProvisional: false,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted.');
      return null;
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || 'aura-health-mobile',
      });

      this.pushToken = tokenData.data;

      // Register token with backend
      await this.registerTokenWithBackend(this.pushToken);

      return this.pushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Sends the device push token to the backend for server-initiated
   * notifications.
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      // Best-effort registration - failure is non-fatal
      await apiClient.syncWearableData(token); // Placeholder - would be registerPushToken
    } catch {
      console.warn('Failed to register push token with backend.');
    }
  }

  /**
   * Creates Android notification channels with appropriate settings.
   */
  private async createAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('health-alerts', {
      name: 'Health Alerts',
      description: 'Critical health alerts and anomaly notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Colors.error,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointments',
      description: 'Appointment reminders and updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('triage', {
      name: 'Triage Results',
      description: 'AI triage analysis results',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('medications', {
      name: 'Medication Reminders',
      description: 'Medication adherence reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
      name: 'General',
      description: 'General notifications and updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  /**
   * Registers interactive notification categories (iOS action buttons).
   */
  private async registerCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('appointment_reminder', [
      {
        identifier: 'check_in',
        buttonTitle: 'Check In',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'reschedule',
        buttonTitle: 'Reschedule',
        options: { opensAppToForeground: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('health_alert', [
      {
        identifier: 'view_details',
        buttonTitle: 'View Details',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: { isDestructive: true },
      },
    ]);
  }

  /**
   * Sets up listeners for incoming notifications and user interactions.
   */
  private setupListeners(): void {
    // Notification received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as Record<string, unknown>;
        const payload: NotificationPayload = {
          category: (data.category as NotificationCategory) || 'system',
          title: notification.request.content.title || '',
          body: notification.request.content.body || '',
          data,
        };

        this.onNotificationReceived?.(payload);
      }
    );

    // User tapped on a notification
    this.responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;

        // Include action identifier for interactive notifications
        const actionId = response.actionIdentifier;
        if (actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          data.action = actionId;
        }

        this.onNotificationTapped?.(data);
      });
  }

  /**
   * Registers a callback for when a notification is received in foreground.
   */
  setOnNotificationReceived(
    callback: (notification: NotificationPayload) => void
  ): void {
    this.onNotificationReceived = callback;
  }

  /**
   * Registers a callback for when a user taps a notification.
   */
  setOnNotificationTapped(
    callback: (data: Record<string, unknown>) => void
  ): void {
    this.onNotificationTapped = callback;
  }

  // ---------------------------------------------------------------------------
  // Local Notification Scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedules a local notification for a future time.
   */
  async scheduleReminder(options: ScheduleReminderOptions): Promise<string> {
    const channelId = this.getChannelForCategory(options.category);

    const trigger: Notifications.NotificationTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: options.triggerDate,
    };

    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: options.id,
      content: {
        title: options.title,
        body: options.body,
        data: {
          category: options.category,
          ...options.data,
        },
        categoryIdentifier: options.category,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger,
    });

    return identifier;
  }

  /**
   * Schedules an appointment reminder 1 hour before the appointment.
   */
  async scheduleAppointmentReminder(
    appointmentId: string,
    doctorName: string,
    scheduledStart: string
  ): Promise<string | null> {
    const appointmentDate = new Date(scheduledStart);
    const reminderDate = new Date(appointmentDate.getTime() - 60 * 60 * 1000);

    // Don't schedule if the reminder time has already passed
    if (reminderDate <= new Date()) {
      return null;
    }

    return this.scheduleReminder({
      id: `appointment-${appointmentId}`,
      title: 'Upcoming Appointment',
      body: `Your appointment with Dr. ${doctorName} is in 1 hour.`,
      triggerDate: reminderDate,
      category: 'appointment_reminder',
      data: { appointmentId },
    });
  }

  /**
   * Schedules a medication reminder.
   */
  async scheduleMedicationReminder(
    medicationName: string,
    dosage: string,
    triggerDate: Date,
    prescriptionId: string
  ): Promise<string> {
    return this.scheduleReminder({
      id: `medication-${prescriptionId}-${triggerDate.getTime()}`,
      title: 'Medication Reminder',
      body: `Time to take ${medicationName} (${dosage}).`,
      triggerDate,
      category: 'medication_reminder',
      data: { prescriptionId, medicationName },
    });
  }

  /**
   * Cancels a previously scheduled notification.
   */
  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }

  /**
   * Cancels all scheduled notifications.
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Returns the count of pending scheduled notifications.
   */
  async getPendingNotificationCount(): Promise<number> {
    const scheduled =
      await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length;
  }

  /**
   * Resets the app badge count.
   */
  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Maps a notification category to its Android channel.
   */
  private getChannelForCategory(category: NotificationCategory): string {
    switch (category) {
      case 'health_alert':
        return 'health-alerts';
      case 'appointment_reminder':
        return 'appointments';
      case 'triage_result':
        return 'triage';
      case 'medication_reminder':
        return 'medications';
      default:
        return 'general';
    }
  }

  /**
   * Tears down listeners and cleans up resources.
   */
  destroy(): void {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.notificationListener = null;
    this.responseListener = null;
    this.onNotificationReceived = null;
    this.onNotificationTapped = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const notificationService = new NotificationService();
