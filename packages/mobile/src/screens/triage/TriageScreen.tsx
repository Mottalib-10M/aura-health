/**
 * TriageScreen
 *
 * Full symptom triage flow with 5 sub-screens:
 *   1. Symptom description with voice input
 *   2. AI follow-up questions (dynamic form)
 *   3. Vital signs entry (manual or wearable sync)
 *   4. AI analysis loading animation
 *   5. Results with urgency, specialists, red flags, diagnostics
 *
 * Uses swipe/button navigation between screens with a progress bar.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useTriage, type TriageStep, type FollowUpAnswer } from '../../hooks/useTriage';
import type { VitalSigns } from '@aura/shared/types/patient';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  formatSpecialtyName,
  formatPercentage,
  formatWaitTime,
  getUrgencyColor,
  getUrgencyBackground,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS: TriageStep[] = ['symptoms', 'follow_up', 'vitals', 'analyzing', 'results'];
const STEP_LABELS = ['Symptoms', 'Follow-up', 'Vitals', 'Analysis', 'Results'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TriageScreen() {
  const triage = useTriage();

  // Local form state
  const [symptomText, setSymptomText] = useState('');
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string | string[] | number>>({});
  const [vitalForm, setVitalForm] = useState<Partial<VitalSigns>>({});
  const [detectedLanguage, setDetectedLanguage] = useState('en');

  const currentStepIndex = STEPS.indexOf(triage.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSubmitSymptoms = useCallback(async () => {
    if (symptomText.trim().length < 10) return;
    await triage.submitSymptoms(symptomText, detectedLanguage);
  }, [detectedLanguage, symptomText, triage]);

  const handleSubmitFollowUp = useCallback(async () => {
    const answers: FollowUpAnswer[] = Object.entries(followUpAnswers).map(
      ([questionId, value]) => ({ questionId, value })
    );
    await triage.submitFollowUpAnswers(answers);
  }, [followUpAnswers, triage]);

  const handleSubmitVitals = useCallback(async () => {
    const vitals: VitalSigns = {
      ...vitalForm,
      recorded_at: new Date().toISOString(),
    };
    await triage.submitVitals(vitals);
  }, [triage, vitalForm]);

  const handleGoBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      triage.setStep(STEPS[prevIndex]);
    }
  }, [currentStepIndex, triage]);

  const handleNewTriage = useCallback(() => {
    triage.reset();
    setSymptomText('');
    setFollowUpAnswers({});
    setVitalForm({});
  }, [triage]);

  // ---------------------------------------------------------------------------
  // Render: Progress Bar
  // ---------------------------------------------------------------------------

  function ProgressBar() {
    return (
      <View style={styles.progressContainer} accessibilityRole="progressbar" accessibilityLabel={`Step ${currentStepIndex + 1} of ${STEPS.length}`}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          {STEP_LABELS.map((label, i) => (
            <Text
              key={label}
              style={[
                styles.progressLabel,
                i === currentStepIndex && styles.progressLabelActive,
                i < currentStepIndex && styles.progressLabelDone,
              ]}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Step 1 - Symptoms
  // ---------------------------------------------------------------------------

  function renderSymptoms() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepTitle}>Describe Your Symptoms</Text>
        <Text style={styles.stepSubtitle}>
          Tell us what you are experiencing. Be as detailed as possible.
        </Text>

        {/* Language badge */}
        <View style={styles.languageBadge}>
          <Badge
            label={`Auto-detect: ${detectedLanguage.toUpperCase()}`}
            color={Colors.info}
            backgroundColor={Colors.infoLight}
            size="sm"
          />
        </View>

        {/* Symptom text input */}
        <View style={styles.symptomInputContainer}>
          <TextInput
            label=""
            placeholder="Describe your symptoms in your own words..."
            value={symptomText}
            onChangeText={(text) => {
              setSymptomText(text);
              // Simple language detection heuristic
              if (/[\u0400-\u04FF]/.test(text)) setDetectedLanguage('ru');
              else if (/[\u0600-\u06FF]/.test(text)) setDetectedLanguage('tg');
              else setDetectedLanguage('en');
            }}
            multiline
            numberOfLines={6}
            containerStyle={styles.symptomInput}
            inputContainerStyle={styles.symptomInputInner}
          />

          {/* Voice input button */}
          <Pressable
            style={styles.micButton}
            accessibilityRole="button"
            accessibilityLabel="Voice input for symptoms"
            onPress={() => {
              // Voice input would be handled here
            }}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7957 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7957 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7957 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7957 1 12 1Z" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
              <Path d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
              <Path d="M12 19V23M8 23H16" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {triage.error && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{triage.error}</Text>
          </View>
        )}

        <Button
          title="Continue"
          onPress={handleSubmitSymptoms}
          loading={triage.isLoading}
          disabled={symptomText.trim().length < 10}
          fullWidth
          size="lg"
          style={styles.continueButton}
        />
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Step 2 - Follow-Up Questions
  // ---------------------------------------------------------------------------

  function renderFollowUp() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Pressable onPress={handleGoBack} style={styles.backLink} accessibilityRole="button" accessibilityLabel="Go back">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>

        <Text style={styles.stepTitle}>Follow-Up Questions</Text>
        <Text style={styles.stepSubtitle}>
          Help the AI narrow down your condition with these additional questions.
        </Text>

        {triage.followUpQuestions.map((question) => (
          <Card key={question.id} style={styles.questionCard} elevation="sm">
            <Text style={styles.questionText}>{question.text}</Text>

            {question.type === 'radio' && question.options && (
              <View style={styles.optionsContainer}>
                {question.options.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.radioOption,
                      followUpAnswers[question.id] === option.value && styles.radioOptionSelected,
                    ]}
                    onPress={() =>
                      setFollowUpAnswers((prev) => ({
                        ...prev,
                        [question.id]: option.value,
                      }))
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected: followUpAnswers[question.id] === option.value }}
                  >
                    <View style={[styles.radioCircle, followUpAnswers[question.id] === option.value && styles.radioCircleSelected]}>
                      {followUpAnswers[question.id] === option.value && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {question.type === 'checkbox' && question.options && (
              <View style={styles.optionsContainer}>
                {question.options.map((option) => {
                  const selectedValues = (followUpAnswers[question.id] as string[]) || [];
                  const isChecked = selectedValues.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.radioOption,
                        isChecked && styles.radioOptionSelected,
                      ]}
                      onPress={() =>
                        setFollowUpAnswers((prev) => {
                          const current = (prev[question.id] as string[]) || [];
                          const next = isChecked
                            ? current.filter((v) => v !== option.value)
                            : [...current, option.value];
                          return { ...prev, [question.id]: next };
                        })
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isChecked }}
                    >
                      <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}>
                        {isChecked && (
                          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <Path d="M20 6L9 17L4 12" stroke={Colors.white} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        )}
                      </View>
                      <Text style={styles.radioLabel}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {question.type === 'slider' && question.sliderConfig && (
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderValue}>
                    {(followUpAnswers[question.id] as number) ?? question.sliderConfig.min}
                    {question.sliderConfig.unit ? ` ${question.sliderConfig.unit}` : ''}
                  </Text>
                </View>
                <View style={styles.sliderInputRow}>
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const current = (followUpAnswers[question.id] as number) ?? question.sliderConfig!.min;
                      const next = Math.max(question.sliderConfig!.min, current - question.sliderConfig!.step);
                      setFollowUpAnswers((prev) => ({ ...prev, [question.id]: next }));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease value"
                  >
                    <Text style={styles.sliderButtonText}>-</Text>
                  </Pressable>
                  <TextInput
                    label=""
                    value={String((followUpAnswers[question.id] as number) ?? question.sliderConfig.min)}
                    onChangeText={(text) => {
                      const num = parseFloat(text);
                      if (!isNaN(num)) {
                        const clamped = Math.min(question.sliderConfig!.max, Math.max(question.sliderConfig!.min, num));
                        setFollowUpAnswers((prev) => ({ ...prev, [question.id]: clamped }));
                      }
                    }}
                    keyboardType="numeric"
                    containerStyle={styles.sliderInput}
                  />
                  <Pressable
                    style={styles.sliderButton}
                    onPress={() => {
                      const current = (followUpAnswers[question.id] as number) ?? question.sliderConfig!.min;
                      const next = Math.min(question.sliderConfig!.max, current + question.sliderConfig!.step);
                      setFollowUpAnswers((prev) => ({ ...prev, [question.id]: next }));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Increase value"
                  >
                    <Text style={styles.sliderButtonText}>+</Text>
                  </Pressable>
                </View>
                <View style={styles.sliderRange}>
                  <Text style={styles.sliderRangeText}>{question.sliderConfig.min}</Text>
                  <Text style={styles.sliderRangeText}>{question.sliderConfig.max}</Text>
                </View>
              </View>
            )}

            {question.type === 'text' && (
              <TextInput
                label=""
                placeholder="Type your answer..."
                value={(followUpAnswers[question.id] as string) || ''}
                onChangeText={(text) =>
                  setFollowUpAnswers((prev) => ({ ...prev, [question.id]: text }))
                }
                containerStyle={styles.noMargin}
              />
            )}
          </Card>
        ))}

        <Button
          title="Continue"
          onPress={handleSubmitFollowUp}
          loading={triage.isLoading}
          fullWidth
          size="lg"
          style={styles.continueButton}
        />
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Step 3 - Vitals
  // ---------------------------------------------------------------------------

  function renderVitals() {
    return (
      <ScrollView contentContainerStyle={styles.stepContent}>
        <Pressable onPress={handleGoBack} style={styles.backLink} accessibilityRole="button">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={styles.backLinkText}>Back</Text>
        </Pressable>

        <Text style={styles.stepTitle}>Vital Signs</Text>
        <Text style={styles.stepSubtitle}>
          Enter your current vital signs or sync from a wearable device.
        </Text>

        {/* Sync from wearable button */}
        <Button
          title="Sync from Wearable"
          variant="secondary"
          fullWidth
          size="md"
          style={styles.syncButton}
          leftIcon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M4 4V9H9" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M20 20V15H15" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M4 9C4.94 6.29 7.27 4.24 10.14 3.55C13.01 2.86 16.02 3.65 18.19 5.62L20 7.36" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
              <Path d="M20 15C19.06 17.71 16.73 19.76 13.86 20.45C10.99 21.14 7.98 20.35 5.81 18.38L4 16.64" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          }
          onPress={() => {
            // Navigate to wearable sync
          }}
          accessibilityLabel="Sync vital signs from wearable device"
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Manual vital sign entry */}
        <View style={styles.vitalsGrid}>
          <TextInput
            label="Heart Rate (bpm)"
            placeholder="e.g., 72"
            value={vitalForm.heart_rate_bpm?.toString() || ''}
            onChangeText={(text) =>
              setVitalForm((prev) => ({
                ...prev,
                heart_rate_bpm: text ? parseInt(text, 10) : undefined,
              }))
            }
            keyboardType="number-pad"
          />

          <View style={styles.bpRow}>
            <View style={styles.bpField}>
              <TextInput
                label="Systolic (mmHg)"
                placeholder="e.g., 120"
                value={vitalForm.blood_pressure?.systolic?.toString() || ''}
                onChangeText={(text) =>
                  setVitalForm((prev) => ({
                    ...prev,
                    blood_pressure: {
                      systolic: text ? parseInt(text, 10) : 0,
                      diastolic: prev.blood_pressure?.diastolic || 0,
                    },
                  }))
                }
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.bpField}>
              <TextInput
                label="Diastolic (mmHg)"
                placeholder="e.g., 80"
                value={vitalForm.blood_pressure?.diastolic?.toString() || ''}
                onChangeText={(text) =>
                  setVitalForm((prev) => ({
                    ...prev,
                    blood_pressure: {
                      systolic: prev.blood_pressure?.systolic || 0,
                      diastolic: text ? parseInt(text, 10) : 0,
                    },
                  }))
                }
                keyboardType="number-pad"
              />
            </View>
          </View>

          <TextInput
            label="Temperature (C)"
            placeholder="e.g., 36.6"
            value={vitalForm.temperature_celsius?.toString() || ''}
            onChangeText={(text) =>
              setVitalForm((prev) => ({
                ...prev,
                temperature_celsius: text ? parseFloat(text) : undefined,
              }))
            }
            keyboardType="decimal-pad"
          />

          <TextInput
            label="SpO2 (%)"
            placeholder="e.g., 98"
            value={vitalForm.spO2_percent?.toString() || ''}
            onChangeText={(text) =>
              setVitalForm((prev) => ({
                ...prev,
                spO2_percent: text ? parseInt(text, 10) : undefined,
              }))
            }
            keyboardType="number-pad"
          />
        </View>

        <Button
          title="Analyze Symptoms"
          onPress={handleSubmitVitals}
          loading={triage.isLoading}
          fullWidth
          size="lg"
          style={styles.continueButton}
        />
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Step 4 - Analyzing
  // ---------------------------------------------------------------------------

  function renderAnalyzing() {
    return <AnalyzingAnimation />;
  }

  // ---------------------------------------------------------------------------
  // Render: Step 5 - Results
  // ---------------------------------------------------------------------------

  function renderResults() {
    const result = triage.result;
    if (!result) return null;

    return (
      <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        {/* Urgency badge */}
        <View style={styles.resultHeader}>
          <Badge urgency={result.urgency_level} size="md" />
          <Text style={styles.resultTitle}>Triage Results</Text>
        </View>

        {/* Red flags */}
        {result.red_flags.length > 0 && (
          <Card
            style={[styles.redFlagCard, { borderLeftColor: Colors.error }]}
            elevation="sm"
          >
            <View style={styles.redFlagHeader}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 9V13M12 17H12.01" stroke={Colors.error} strokeWidth={2} strokeLinecap="round" />
                <SvgCircle cx={12} cy={12} r={10} stroke={Colors.error} strokeWidth={1.5} />
              </Svg>
              <Text style={styles.redFlagTitle}>Red Flags</Text>
            </View>
            {result.red_flags.map((flag, i) => (
              <Text key={i} style={styles.redFlagItem}>
                {'\u2022'} {flag}
              </Text>
            ))}
          </Card>
        )}

        {/* Recommended specialists */}
        <Text style={styles.resultSectionTitle}>Recommended Specialists</Text>
        {result.recommended_specializations.map((spec, i) => (
          <Card key={i} style={styles.specialistCard} elevation="sm" pressable onPress={() => {}}>
            <View style={styles.specialistHeader}>
              <Text style={styles.specialistName}>
                {formatSpecialtyName(spec.specialty)}
              </Text>
              <Text style={styles.specialistConfidence}>
                {formatPercentage(spec.confidence_score)} match
              </Text>
            </View>
            <Text style={styles.specialistRationale}>{spec.rationale}</Text>
            <View style={styles.specialistFooter}>
              <Text style={styles.specialistWait}>
                Est. wait: {formatWaitTime(spec.estimated_wait_time_minutes)}
              </Text>
              <Button
                title="Book"
                variant="primary"
                size="sm"
                onPress={() => {}}
                accessibilityLabel={`Book appointment with ${formatSpecialtyName(spec.specialty)}`}
              />
            </View>
          </Card>
        ))}

        {/* Suggested diagnostics */}
        {result.suggested_diagnostics.length > 0 && (
          <>
            <Text style={styles.resultSectionTitle}>Suggested Diagnostics</Text>
            <Card style={styles.diagnosticsCard} elevation="sm">
              {result.suggested_diagnostics.map((diag, i) => (
                <View key={i} style={styles.diagnosticItem}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 11L12 14L22 4" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
                    <Path d="M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                  <Text style={styles.diagnosticText}>{diag}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Actions */}
        <View style={styles.resultActions}>
          <Button
            title="Save Results"
            variant="secondary"
            size="md"
            onPress={() => triage.saveToHistory()}
            accessibilityLabel="Save triage results to your history"
          />
          <Button
            title="Share with Doctor"
            variant="outline"
            size="md"
            onPress={() => {
              // Open doctor selection
            }}
            accessibilityLabel="Share triage results with a doctor"
          />
        </View>

        <Button
          title="New Symptom Check"
          variant="ghost"
          fullWidth
          size="md"
          onPress={handleNewTriage}
          style={styles.newTriageButton}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProgressBar />

      <View style={styles.screenContainer}>
        {triage.currentStep === 'symptoms' && renderSymptoms()}
        {triage.currentStep === 'follow_up' && renderFollowUp()}
        {triage.currentStep === 'vitals' && renderVitals()}
        {triage.currentStep === 'analyzing' && renderAnalyzing()}
        {triage.currentStep === 'results' && renderResults()}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Analyzing Animation Sub-component
// ---------------------------------------------------------------------------

function AnalyzingAnimation() {
  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, [pulse, rotation]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={analyzingStyles.container}>
      <Animated.View style={[analyzingStyles.iconContainer, pulseStyle]}>
        <Animated.View style={spinStyle}>
          <Svg width={64} height={64} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="Analyzing">
            <Path d="M6 2V8C6 11.3137 8.68629 14 12 14C15.3137 14 18 11.3137 18 8V2" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
            <Path d="M12 14V17" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" />
            <SvgCircle cx={12} cy={20} r={2} stroke={Colors.primary} strokeWidth={2} />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Text style={analyzingStyles.title}>AI is analyzing your symptoms...</Text>
      <Text style={analyzingStyles.subtitle}>
        Our model is reviewing your symptoms, vitals, and medical history to
        provide the best recommendations.
      </Text>

      <ActivityIndicator
        size="small"
        color={Colors.primary}
        style={analyzingStyles.spinner}
      />
    </View>
  );
}

const analyzingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    ...Typography.h3,
    color: Colors.darkBlue,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  spinner: {
    marginTop: Spacing.lg,
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.gray200,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
    fontSize: 9,
  },
  progressLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  progressLabelDone: {
    color: Colors.success,
  },
  stepContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxxl,
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  backLinkText: {
    ...Typography.bodySmMedium,
    color: Colors.primary,
  },
  languageBadge: {
    marginBottom: Spacing.lg,
  },
  symptomInputContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  symptomInput: {
    marginBottom: 0,
  },
  symptomInputInner: {
    minHeight: 140,
    alignItems: 'flex-start',
    paddingTop: Spacing.md,
  },
  micButton: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButton: {
    marginTop: Spacing.lg,
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
  questionCard: {
    marginBottom: Spacing.md,
  },
  questionText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  radioOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    ...Typography.bodySm,
    color: Colors.textPrimary,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: Radius.xs,
    borderWidth: 2,
    borderColor: Colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sliderContainer: {
    paddingVertical: Spacing.sm,
  },
  sliderHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sliderValue: {
    ...Typography.h4,
    color: Colors.primary,
  },
  sliderInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  sliderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  sliderInput: {
    width: 80,
    marginBottom: 0,
  },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  sliderRangeText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  noMargin: {
    marginBottom: 0,
  },
  syncButton: {
    marginBottom: Spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  vitalsGrid: {},
  bpRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bpField: {
    flex: 1,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  resultTitle: {
    ...Typography.h2,
    color: Colors.darkBlue,
  },
  redFlagCard: {
    marginBottom: Spacing.xxl,
    borderLeftWidth: 4,
    backgroundColor: Colors.errorLight,
  },
  redFlagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  redFlagTitle: {
    ...Typography.bodyMedium,
    color: Colors.error,
    fontWeight: '700',
  },
  redFlagItem: {
    ...Typography.bodySm,
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    lineHeight: 20,
    paddingLeft: Spacing.sm,
  },
  resultSectionTitle: {
    ...Typography.h4,
    color: Colors.darkBlue,
    marginBottom: Spacing.md,
  },
  specialistCard: {
    marginBottom: Spacing.md,
  },
  specialistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  specialistName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  specialistConfidence: {
    ...Typography.captionMedium,
    color: Colors.primary,
  },
  specialistRationale: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  specialistFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specialistWait: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  diagnosticsCard: {
    marginBottom: Spacing.xxl,
  },
  diagnosticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  diagnosticText: {
    ...Typography.bodySm,
    color: Colors.textPrimary,
    flex: 1,
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  newTriageButton: {
    marginTop: Spacing.sm,
  },
  bottomSpacer: {
    height: Spacing.xxxxl,
  },
});
