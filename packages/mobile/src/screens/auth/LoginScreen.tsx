/**
 * LoginScreen
 *
 * Patient-facing login screen with phone/email authentication and
 * biometric login support. Features the Aura Health logo and tagline,
 * a country code selector for Central Asian phone numbers, and a
 * language selector at the bottom.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { AuthScreenProps } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { BottomSheet, type BottomSheetRef } from '../../components/ui/BottomSheet';
import { useAuth } from '../../hooks/useAuth';
import { useBiometric } from '../../hooks/useBiometric';
import { useAuthStore } from '../../stores/authStore';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  countryCodes,
  supportedLanguages,
  type CountryCode,
  type Language,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { login, loginWithBiometric, isLoading, error, clearError } = useAuth();
  const { isAvailable, isEnrolled, biometricLabel, authenticate } = useBiometric();
  const { language, setLanguage, biometricEnabled } = useAuthStore();

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(countryCodes[0]);
  const [showPassword, setShowPassword] = useState(false);

  // Bottom sheet refs
  const countrySheetRef = useRef<BottomSheetRef>(null);
  const languageSheetRef = useRef<BottomSheetRef>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLogin = useCallback(async () => {
    clearError();

    const loginIdentifier = isEmailMode
      ? identifier
      : `${selectedCountry.dialCode}${identifier}`;

    await login(loginIdentifier, password, isEmailMode);
  }, [clearError, identifier, isEmailMode, login, password, selectedCountry]);

  const handleBiometricLogin = useCallback(async () => {
    clearError();

    // First verify biometric on device
    const biometricResult = await authenticate(
      'Verify your identity to log in'
    );

    if (!biometricResult.success) {
      return;
    }

    // Then exchange biometric token with server
    await loginWithBiometric();
  }, [authenticate, clearError, loginWithBiometric]);

  const handleCountrySelect = useCallback((country: CountryCode) => {
    setSelectedCountry(country);
    countrySheetRef.current?.close();
  }, []);

  const handleLanguageSelect = useCallback(
    (lang: Language) => {
      setLanguage(lang.code);
      languageSheetRef.current?.close();
    },
    [setLanguage]
  );

  const toggleInputMode = useCallback(() => {
    setIsEmailMode((prev) => !prev);
    setIdentifier('');
    clearError();
  }, [clearError]);

  const canSubmit = identifier.trim().length > 0 && password.length >= 6;

  const selectedLanguage =
    supportedLanguages.find((l) => l.code === language) || supportedLanguages[4];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Tagline */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Aura Health logo">
                <Path
                  d="M12 3C12 3 8 7 8 11C8 13.2091 9.79086 15 12 15C14.2091 15 16 13.2091 16 11C16 7 12 3 12 3Z"
                  fill={Colors.white}
                  stroke={Colors.white}
                  strokeWidth={1.5}
                />
                <Path
                  d="M12 15V21"
                  stroke={Colors.white}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Path
                  d="M9 18H15"
                  stroke={Colors.white}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </View>
            <Text style={styles.appName} accessibilityRole="header">
              Aura Health
            </Text>
            <Text style={styles.tagline}>
              AI-powered healthcare for Central Asia
            </Text>
          </View>

          {/* Error display */}
          {error && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Login form */}
          <View style={styles.form}>
            {isEmailMode ? (
              <TextInput
                label="Email"
                placeholder="you@example.com"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            ) : (
              <View>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.phoneRow}>
                  {/* Country code selector */}
                  <Pressable
                    style={styles.countryCodeButton}
                    onPress={() => countrySheetRef.current?.open()}
                    accessibilityRole="button"
                    accessibilityLabel={`Country code: ${selectedCountry.dialCode}. Tap to change.`}
                  >
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryDialCode}>
                      {selectedCountry.dialCode}
                    </Text>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path d="M6 9L12 15L18 9" stroke={Colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  </Pressable>

                  {/* Phone number input */}
                  <View style={styles.phoneInputContainer}>
                    <TextInput
                      label=""
                      placeholder="XX XXX XXXX"
                      value={identifier}
                      onChangeText={setIdentifier}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      containerStyle={styles.phoneInput}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Password */}
            <TextInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              rightIcon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  {showPassword ? (
                    <>
                      <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke={Colors.textTertiary} strokeWidth={1.5} />
                      <Circle cx={12} cy={12} r={3} stroke={Colors.textTertiary} strokeWidth={1.5} />
                    </>
                  ) : (
                    <>
                      <Path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12" stroke={Colors.textTertiary} strokeWidth={1.5} />
                      <Path d="M3 21L21 3" stroke={Colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
                    </>
                  )}
                </Svg>
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Toggle email/phone */}
            <Pressable
              onPress={toggleInputMode}
              style={styles.toggleMode}
              accessibilityRole="button"
              accessibilityLabel={
                isEmailMode
                  ? 'Switch to phone number login'
                  : 'Switch to email login'
              }
            >
              <Text style={styles.toggleModeText}>
                {isEmailMode
                  ? 'Use phone number instead'
                  : 'Use email instead'}
              </Text>
            </Pressable>

            {/* Login button */}
            <Button
              title="Log In"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!canSubmit}
              fullWidth
              size="lg"
              accessibilityLabel="Log in to your account"
            />

            {/* Biometric login */}
            {biometricEnabled && isAvailable && isEnrolled && (
              <Button
                title={`Log in with ${biometricLabel}`}
                variant="outline"
                onPress={handleBiometricLogin}
                loading={isLoading}
                fullWidth
                size="lg"
                style={styles.biometricButton}
                leftIcon={
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2C9.79 2 8 3.79 8 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8H16V6C16 3.79 14.21 2 12 2ZM12 4C13.1 4 14 4.9 14 6V8H10V6C10 4.9 10.9 4 12 4ZM12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13Z"
                      fill={Colors.primary}
                    />
                  </Svg>
                }
                accessibilityLabel={`Log in with ${biometricLabel}`}
              />
            )}

            {/* Register link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>
                Don't have an account?{' '}
              </Text>
              <Pressable
                onPress={() => navigation.navigate('Register')}
                accessibilityRole="link"
                accessibilityLabel="Create a new account"
              >
                <Text style={styles.registerLink}>Register</Text>
              </Pressable>
            </View>
          </View>

          {/* Language selector */}
          <Pressable
            style={styles.languageSelector}
            onPress={() => languageSheetRef.current?.open()}
            accessibilityRole="button"
            accessibilityLabel={`Current language: ${selectedLanguage.name}. Tap to change.`}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={10} stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M2 12H22" stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M12 2C14.5 4.5 16 8 16 12C16 16 14.5 19.5 12 22" stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M12 2C9.5 4.5 8 8 8 12C8 16 9.5 19.5 12 22" stroke={Colors.textTertiary} strokeWidth={1.5} />
            </Svg>
            <Text style={styles.languageText}>
              {selectedLanguage.nativeName}
            </Text>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d="M6 9L12 15L18 9" stroke={Colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Bottom Sheet */}
      <BottomSheet ref={countrySheetRef} title="Select Country" snapPoint={0.4}>
        <View style={styles.sheetContent}>
          {countryCodes.map((country) => (
            <Pressable
              key={country.code}
              style={[
                styles.sheetOption,
                selectedCountry.code === country.code && styles.sheetOptionSelected,
              ]}
              onPress={() => handleCountrySelect(country)}
              accessibilityRole="button"
              accessibilityLabel={`${country.name} ${country.dialCode}`}
            >
              <Text style={styles.sheetOptionFlag}>{country.flag}</Text>
              <Text style={styles.sheetOptionLabel}>{country.name}</Text>
              <Text style={styles.sheetOptionValue}>{country.dialCode}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* Language Bottom Sheet */}
      <BottomSheet ref={languageSheetRef} title="Select Language" snapPoint={0.45}>
        <View style={styles.sheetContent}>
          {supportedLanguages.map((lang) => (
            <Pressable
              key={lang.code}
              style={[
                styles.sheetOption,
                language === lang.code && styles.sheetOptionSelected,
              ]}
              onPress={() => handleLanguageSelect(lang)}
              accessibilityRole="button"
              accessibilityLabel={`${lang.name} (${lang.nativeName})`}
            >
              <Text style={styles.sheetOptionLabel}>{lang.name}</Text>
              <Text style={styles.sheetOptionValue}>{lang.nativeName}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxxl,
    paddingBottom: Spacing.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  appName: {
    ...Typography.h1,
    color: Colors.darkBlue,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.bodySm,
    color: Colors.error,
  },
  form: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.bodySmMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 48,
    gap: Spacing.xs,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryDialCode: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  phoneInputContainer: {
    flex: 1,
  },
  phoneInput: {
    marginBottom: 0,
  },
  toggleMode: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xxl,
    paddingVertical: Spacing.xs,
  },
  toggleModeText: {
    ...Typography.bodySm,
    color: Colors.primary,
    fontWeight: '500',
  },
  biometricButton: {
    marginTop: Spacing.md,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.sm,
  },
  registerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  registerLink: {
    ...Typography.bodyMedium,
    color: Colors.primary,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.xl,
  },
  languageText: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
  },
  sheetContent: {
    gap: Spacing.xs,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  sheetOptionSelected: {
    backgroundColor: Colors.primaryFaded,
  },
  sheetOptionFlag: {
    fontSize: 22,
  },
  sheetOptionLabel: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  sheetOptionValue: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
  },
});
