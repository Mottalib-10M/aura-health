/**
 * RegisterScreen
 *
 * Multi-step patient registration flow:
 *   Step 1: Phone number entry + OTP verification
 *   Step 2: Personal information (name, DOB, sex, region/city)
 *   Step 3: Biometric enrollment prompt
 *
 * Displays progress indicator dots at the top and swipe-back
 * navigation between steps.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AuthScreenProps } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../services/api';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  countryCodes,
  type CountryCode,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 3;

const SEX_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
] as const;

const REGIONS = [
  'Tashkent', 'Samarkand', 'Bukhara', 'Fergana', 'Andijan',
  'Namangan', 'Kashkadarya', 'Surkhandarya', 'Khorezm', 'Navoi',
  'Jizzakh', 'Syrdarya', 'Karakalpakstan',
  'Bishkek', 'Osh', 'Jalal-Abad', 'Batken', 'Issyk-Kul',
  'Dushanbe', 'Khujand', 'Kulob', 'Bokhtar',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const { register, isLoading, error, clearError } = useAuth();

  // Step management
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state: Phone + OTP
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCodes[0]);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Step 2 state: Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRequestOtp = useCallback(async () => {
    clearError();
    setOtpLoading(true);

    try {
      const fullPhone = `${selectedCountry.dialCode}${phone}`;
      const result = await apiClient.requestOtp(fullPhone);

      if (result.success) {
        setOtpSent(true);
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to send verification code.'
      );
    } finally {
      setOtpLoading(false);
    }
  }, [clearError, phone, selectedCountry.dialCode]);

  const handleVerifyOtp = useCallback(async () => {
    clearError();
    setOtpLoading(true);

    try {
      const fullPhone = `${selectedCountry.dialCode}${phone}`;
      const result = await apiClient.verifyOtp(fullPhone, otpCode);

      if (result.success) {
        setOtpVerified(true);
        setCurrentStep(2);
      }
    } catch (err) {
      Alert.alert(
        'Invalid Code',
        err instanceof Error ? err.message : 'The verification code is incorrect.'
      );
    } finally {
      setOtpLoading(false);
    }
  }, [clearError, otpCode, phone, selectedCountry.dialCode]);

  const handleSubmitPersonalInfo = useCallback(async () => {
    clearError();

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing Information', 'Please enter your first and last name.');
      return;
    }

    if (!dateOfBirth.trim()) {
      Alert.alert('Missing Information', 'Please enter your date of birth.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    const success = await register({
      phone,
      countryCode: selectedCountry.dialCode,
      firstName,
      lastName,
      dateOfBirth,
      sex,
      region,
      city,
      preferredLanguage: 'en',
      otpCode,
    });

    if (success) {
      setCurrentStep(3);
    }
  }, [
    clearError,
    confirmPassword,
    dateOfBirth,
    firstName,
    lastName,
    otpCode,
    password,
    phone,
    region,
    city,
    register,
    selectedCountry.dialCode,
    sex,
  ]);

  const handleBiometricSetup = useCallback(() => {
    navigation.navigate('BiometricSetup', {
      userId: '', // Will be populated from auth store
      isOnboarding: true,
    });
  }, [navigation]);

  const handleSkipBiometric = useCallback(() => {
    // Biometric setup is optional during onboarding
    // User is already registered and authenticated at this point
  }, []);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  // ---------------------------------------------------------------------------
  // Progress Dots
  // ---------------------------------------------------------------------------

  function ProgressDots() {
    return (
      <View style={styles.progressContainer} accessibilityRole="progressbar" accessibilityLabel={`Step ${currentStep} of ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i + 1 === currentStep && styles.progressDotActive,
              i + 1 < currentStep && styles.progressDotCompleted,
            ]}
          />
        ))}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 1: Phone + OTP
  // ---------------------------------------------------------------------------

  function renderStep1() {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Create your account</Text>
        <Text style={styles.stepSubtitle}>
          Enter your phone number to get started
        </Text>

        <View style={styles.phoneRow}>
          <Pressable
            style={styles.countryButton}
            onPress={() => {
              // Cycle through countries for simplicity
              const idx = countryCodes.indexOf(selectedCountry);
              setSelectedCountry(
                countryCodes[(idx + 1) % countryCodes.length]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel={`Country: ${selectedCountry.name}`}
          >
            <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
            <Text style={styles.countryCode}>{selectedCountry.dialCode}</Text>
          </Pressable>

          <View style={styles.phoneInputWrapper}>
            <TextInput
              label=""
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              containerStyle={styles.noMargin}
              disabled={otpSent}
            />
          </View>
        </View>

        {!otpSent ? (
          <Button
            title="Send Verification Code"
            onPress={handleRequestOtp}
            loading={otpLoading}
            disabled={phone.length < 7}
            fullWidth
            size="lg"
          />
        ) : (
          <View style={styles.otpSection}>
            <Text style={styles.otpInfo}>
              A 6-digit code was sent to {selectedCountry.dialCode}
              {phone}
            </Text>

            <TextInput
              label="Verification Code"
              placeholder="Enter 6-digit code"
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <Button
              title="Verify"
              onPress={handleVerifyOtp}
              loading={otpLoading}
              disabled={otpCode.length !== 6}
              fullWidth
              size="lg"
            />

            <Pressable
              onPress={handleRequestOtp}
              style={styles.resendLink}
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
            >
              <Text style={styles.resendText}>Resend code</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 2: Personal Info
  // ---------------------------------------------------------------------------

  function renderStep2() {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Personal Information</Text>
        <Text style={styles.stepSubtitle}>
          This information helps us provide accurate health recommendations
        </Text>

        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <TextInput
              label="First Name"
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              required
            />
          </View>
          <View style={styles.nameField}>
            <TextInput
              label="Last Name"
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              required
            />
          </View>
        </View>

        <TextInput
          label="Date of Birth"
          placeholder="YYYY-MM-DD"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
          required
        />

        {/* Sex selector */}
        <View style={styles.sexContainer}>
          <Text style={styles.fieldLabel}>Biological Sex</Text>
          <View style={styles.sexOptions}>
            {SEX_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sexOption,
                  sex === option.value && styles.sexOptionSelected,
                ]}
                onPress={() => setSex(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: sex === option.value }}
                accessibilityLabel={option.label}
              >
                <Text
                  style={[
                    styles.sexOptionText,
                    sex === option.value && styles.sexOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Region/City */}
        <TextInput
          label="Region"
          placeholder="Select your region"
          value={region}
          onChangeText={setRegion}
          required
        />

        <TextInput
          label="City"
          placeholder="Enter your city"
          value={city}
          onChangeText={setCity}
        />

        {/* Password */}
        <TextInput
          label="Password"
          placeholder="Create a password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          required
          error={
            password.length > 0 && password.length < 8
              ? 'Password must be at least 8 characters'
              : undefined
          }
        />

        <TextInput
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          required
          error={
            confirmPassword.length > 0 && confirmPassword !== password
              ? 'Passwords do not match'
              : undefined
          }
        />

        {error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          title="Create Account"
          onPress={handleSubmitPersonalInfo}
          loading={isLoading}
          fullWidth
          size="lg"
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Step 3: Biometric prompt
  // ---------------------------------------------------------------------------

  function renderStep3() {
    return (
      <View style={styles.stepContent}>
        <View style={styles.successIcon}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Success checkmark">
            <Path
              d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.86"
              stroke={Colors.success}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M22 4L12 14.01L9 11.01"
              stroke={Colors.success}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>

        <Text style={styles.stepTitle}>Account Created!</Text>
        <Text style={styles.stepSubtitle}>
          Secure your account with biometric authentication for faster,
          passwordless login.
        </Text>

        <View style={styles.biometricCard}>
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Face recognition icon">
            <Path
              d="M7 3H5C3.89543 3 3 3.89543 3 5V7"
              stroke={Colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M17 3H19C20.1046 3 21 3.89543 21 5V7"
              stroke={Colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M7 21H5C3.89543 21 3 20.1046 3 19V17"
              stroke={Colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M17 21H19C20.1046 21 21 20.1046 21 19V17"
              stroke={Colors.primary}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"
              stroke={Colors.primary}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path d="M9 9H9.01" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
            <Path d="M15 9H15.01" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>

          <View style={styles.biometricCardText}>
            <Text style={styles.biometricCardTitle}>Set Up Face Recognition</Text>
            <Text style={styles.biometricCardSubtitle}>
              Quick and secure login with your face
            </Text>
          </View>
        </View>

        <Button
          title="Set Up Biometrics"
          onPress={handleBiometricSetup}
          fullWidth
          size="lg"
        />

        <Button
          title="Skip for now"
          variant="ghost"
          onPress={handleSkipBiometric}
          fullWidth
          size="md"
          style={styles.skipButton}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke={Colors.textPrimary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          <ProgressDots />

          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gray300,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
    borderRadius: 5,
  },
  progressDotCompleted: {
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxxl,
  },
  stepContent: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  stepTitle: {
    ...Typography.h2,
    color: Colors.darkBlue,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    lineHeight: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    gap: Spacing.xs,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCode: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  noMargin: {
    marginBottom: 0,
  },
  otpSection: {
    gap: Spacing.md,
  },
  otpInfo: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  resendLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameField: {
    flex: 1,
  },
  sexContainer: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.bodySmMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  sexOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sexOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  sexOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  sexOptionText: {
    ...Typography.bodySmMedium,
    color: Colors.textSecondary,
  },
  sexOptionTextSelected: {
    color: Colors.primary,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.bodySm,
    color: Colors.error,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  biometricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFaded,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  biometricCardText: {
    flex: 1,
  },
  biometricCardTitle: {
    ...Typography.bodyMedium,
    color: Colors.darkBlue,
    marginBottom: Spacing.xxs,
  },
  biometricCardSubtitle: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
  },
  skipButton: {
    marginTop: Spacing.sm,
  },
});
