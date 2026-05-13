/**
 * ProfileScreen
 *
 * Patient profile management screen with:
 *   - Avatar with camera edit option
 *   - Personal info section (editable)
 *   - Medical history section
 *   - Connected devices list
 *   - Prescription history link
 *   - Settings (notifications, language, biometric lock, data sharing)
 *   - Logout button
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';
import { useHealthStore } from '../../stores/healthStore';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  supportedLanguages,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SettingsRow({ icon, title, subtitle, onPress, rightElement, danger }: SettingsRowProps) {
  return (
    <Pressable
      style={styles.settingsRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.settingsIcon, danger && styles.settingsIconDanger]}>
        {icon}
      </View>
      <View style={styles.settingsInfo}>
        <Text style={[styles.settingsTitle, danger && styles.settingsTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18L15 12L9 6" stroke={Colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {title}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileScreen() {
  const { logout, isLoading } = useAuth();
  const { user, language, biometricEnabled, setBiometricEnabled } = useAuthStore();
  const { connectedDevices } = useHealthStore();

  const selectedLanguage = supportedLanguages.find((l) => l.code === language) || supportedLanguages[4];

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of Aura Health?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  }, [logout]);

  const handleToggleBiometric = useCallback(() => {
    setBiometricEnabled(!biometricEnabled);
  }, [biometricEnabled, setBiometricEnabled]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Pressable
              style={styles.avatarEditButton}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={() => {}}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" stroke={Colors.white} strokeWidth={2} />
                <SvgCircle cx={12} cy={13} r={4} stroke={Colors.white} strokeWidth={2} />
              </Svg>
            </Pressable>
          </View>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>

        {/* Personal Info */}
        <SectionHeader title="Personal Information" />
        <Card style={styles.settingsCard} elevation="sm">
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <SvgCircle cx={12} cy={8} r={4} stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20V21H5V20Z" stroke={Colors.primary} strokeWidth={1.5} />
              </Svg>
            }
            title="Edit Profile"
            subtitle="Name, date of birth, contact info"
            onPress={() => {}}
          />
        </Card>

        {/* Medical */}
        <SectionHeader title="Medical" />
        <Card style={styles.settingsCard} elevation="sm">
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M9 2H15V5H9V2Z" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
                <Path d="M4 5H20V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V5Z" stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M9 12H15M12 9V15" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="Medical History"
            subtitle="Conditions, allergies, medications"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M7 7H17M7 12H13M7 17H10" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="Prescription History"
            subtitle="Past and active prescriptions"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2Z" stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M7 12H10L12 8L14 16L16 12H17" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
            title="Connected Devices"
            subtitle={`${connectedDevices.length} device${connectedDevices.length !== 1 ? 's' : ''} connected`}
            onPress={() => {}}
          />
        </Card>

        {/* Settings */}
        <SectionHeader title="Settings" />
        <Card style={styles.settingsCard} elevation="sm">
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="Notifications"
            subtitle="Push notification preferences"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <SvgCircle cx={12} cy={12} r={10} stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M2 12H22M12 2C14.5 4.5 16 8 16 12C16 16 14.5 19.5 12 22M12 2C9.5 4.5 8 8 8 12C8 16 9.5 19.5 12 22" stroke={Colors.primary} strokeWidth={1.5} />
              </Svg>
            }
            title="Language"
            subtitle={selectedLanguage.nativeName}
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2C9.79 2 8 3.79 8 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8H16V6C16 3.79 14.21 2 12 2ZM12 4C13.1 4 14 4.9 14 6V8H10V6C10 4.9 10.9 4 12 4Z" stroke={Colors.primary} strokeWidth={1.5} />
              </Svg>
            }
            title="Biometric Lock"
            subtitle={biometricEnabled ? 'Enabled' : 'Disabled'}
            onPress={handleToggleBiometric}
            rightElement={
              <View
                style={[
                  styles.toggle,
                  biometricEnabled && styles.toggleActive,
                ]}
                accessibilityRole="switch"
                accessibilityState={{ checked: biometricEnabled }}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    biometricEnabled && styles.toggleThumbActive,
                  ]}
                />
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={Colors.primary} strokeWidth={1.5} />
              </Svg>
            }
            title="Data Sharing"
            subtitle="Control who sees your health data"
            onPress={() => {}}
          />
        </Card>

        {/* About */}
        <SectionHeader title="About" />
        <Card style={styles.settingsCard} elevation="sm">
          <SettingsRow
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <SvgCircle cx={12} cy={12} r={10} stroke={Colors.primary} strokeWidth={1.5} />
                <Path d="M12 16V12M12 8H12.01" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            }
            title="About Aura Health"
            subtitle="Version 1.0.0"
            onPress={() => {}}
          />
        </Card>

        {/* Logout */}
        <Button
          title="Log Out"
          variant="danger"
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleLogout}
          style={styles.logoutButton}
          accessibilityLabel="Log out of Aura Health"
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarText: {
    ...Typography.h2,
    color: Colors.primary,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileName: {
    ...Typography.h3,
    color: Colors.darkBlue,
    marginBottom: Spacing.xxs,
  },
  profileEmail: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    ...Typography.captionMedium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingLeft: Spacing.xs,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconDanger: {
    backgroundColor: Colors.errorLight,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  settingsTitleDanger: {
    color: Colors.error,
  },
  settingsSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xxs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gray300,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  logoutButton: {
    marginTop: Spacing.xxl,
  },
  bottomSpacer: {
    height: Spacing.section,
  },
});
