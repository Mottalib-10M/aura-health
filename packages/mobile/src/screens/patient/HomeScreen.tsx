/**
 * HomeScreen
 *
 * Patient home dashboard showing:
 *   - Greeting with patient name and current date
 *   - Health score card (circular progress)
 *   - Vital signs row (HR, SpO2, HRV mini cards with sparklines)
 *   - AI Alert banner (if anomaly detected)
 *   - "Check Symptoms" CTA
 *   - Upcoming appointment card
 *   - Recent activity list
 *   - Pull-to-refresh
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle as SvgCircle, Path, Line } from 'react-native-svg';
import { format } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../stores/authStore';
import { useHealthStore } from '../../stores/healthStore';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  formatHeartRate,
  formatSpO2,
  formatRelativeTime,
  formatDateTime,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CIRCLE_RADIUS = 54;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.xxl * 2 - Spacing.md * 2) / 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const {
    healthScore,
    latestVitals,
    alerts,
    vitals,
    isLoading,
  } = useHealthStore();

  const [refreshing, setRefreshing] = React.useState(false);
  const today = format(new Date(), 'EEEE, MMMM d');

  const firstName = user?.name?.split(' ')[0] || 'Patient';

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // In production, this would refetch health data from the API
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  }, []);

  // Health score progress
  const score = healthScore?.overall ?? 0;
  const scoreProgress = (score / 100) * CIRCLE_CIRCUMFERENCE;
  const scoreColor =
    score >= 80 ? Colors.success : score >= 60 ? Colors.warning : Colors.error;

  // Active (unread) alerts
  const activeAlerts = useMemo(
    () => alerts.filter((a) => !a.read && (a.severity === 'alert' || a.severity === 'critical')),
    [alerts]
  );

  // Mini sparkline for vital cards
  function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = CARD_WIDTH - Spacing.lg * 2;
    const h = 24;
    const points = data.slice(-12).map((val, i, arr) => ({
      x: (i / (arr.length - 1)) * w,
      y: h - ((val - min) / range) * h,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    return (
      <Svg width={w} height={h} accessibilityRole="image" accessibilityLabel="Trend sparkline">
        <Path d={pathD} stroke={color} strokeWidth={1.5} fill="none" />
      </Svg>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingName} accessibilityRole="header">
              Hello, {firstName}
            </Text>
            <Text style={styles.greetingDate}>{today}</Text>
          </View>
          <Pressable
            style={styles.notificationButton}
            onPress={() => {
              // Navigate to notifications
            }}
            accessibilityRole="button"
            accessibilityLabel={`Notifications. ${alerts.filter((a) => !a.read).length} unread`}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={Colors.darkBlue} strokeWidth={1.5} strokeLinecap="round" />
              <Path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke={Colors.darkBlue} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
            {alerts.some((a) => !a.read) && <View style={styles.notificationDot} />}
          </Pressable>
        </View>

        {/* Health Score Card */}
        <Card style={styles.healthScoreCard} elevation="md">
          <View style={styles.healthScoreContent}>
            <View style={styles.healthScoreCircle}>
              <Svg width={132} height={132} viewBox="0 0 132 132" accessibilityRole="progressbar" accessibilityLabel={`Health score: ${score} out of 100`}>
                {/* Background circle */}
                <SvgCircle
                  cx={66}
                  cy={66}
                  r={CIRCLE_RADIUS}
                  stroke={Colors.gray200}
                  strokeWidth={8}
                  fill="none"
                />
                {/* Progress arc */}
                <SvgCircle
                  cx={66}
                  cy={66}
                  r={CIRCLE_RADIUS}
                  stroke={scoreColor}
                  strokeWidth={8}
                  fill="none"
                  strokeDasharray={`${scoreProgress} ${CIRCLE_CIRCUMFERENCE}`}
                  strokeDashoffset={CIRCLE_CIRCUMFERENCE * 0.25}
                  strokeLinecap="round"
                  transform="rotate(-90, 66, 66)"
                />
              </Svg>
              <View style={styles.healthScoreValue}>
                <Text style={[styles.scoreNumber, { color: scoreColor }]}>
                  {score || '--'}
                </Text>
                <Text style={styles.scoreLabel}>Health Score</Text>
              </View>
            </View>

            <View style={styles.healthScoreInfo}>
              <Text style={styles.healthScoreTitle}>Overall Health</Text>
              <Text style={styles.healthScoreDesc}>
                {score >= 80
                  ? 'Your health metrics look great!'
                  : score >= 60
                  ? 'Some areas need attention.'
                  : score > 0
                  ? 'Please review your health data.'
                  : 'Sync your wearable to get started.'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Vital Signs Row */}
        <View style={styles.vitalsRow}>
          {/* Heart Rate */}
          <Card style={styles.vitalCard} elevation="sm">
            <Text style={styles.vitalLabel}>Heart Rate</Text>
            <Text style={[styles.vitalValue, { color: Colors.chartHeartRate }]}>
              {latestVitals?.heart_rate_bpm
                ? formatHeartRate(latestVitals.heart_rate_bpm)
                : '--'}
            </Text>
            <Sparkline
              data={vitals.heartRate.map((p) => p.value).slice(-12)}
              color={Colors.chartHeartRate}
            />
          </Card>

          {/* SpO2 */}
          <Card style={styles.vitalCard} elevation="sm">
            <Text style={styles.vitalLabel}>SpO2</Text>
            <Text style={[styles.vitalValue, { color: Colors.chartSpO2 }]}>
              {latestVitals?.spO2_percent
                ? formatSpO2(latestVitals.spO2_percent)
                : '--'}
            </Text>
            <Sparkline
              data={vitals.spO2.map((p) => p.value).slice(-12)}
              color={Colors.chartSpO2}
            />
          </Card>

          {/* HRV */}
          <Card style={styles.vitalCard} elevation="sm">
            <Text style={styles.vitalLabel}>HRV</Text>
            <Text style={[styles.vitalValue, { color: Colors.chartHRV }]}>
              {vitals.hrv.length > 0
                ? `${Math.round(vitals.hrv[vitals.hrv.length - 1].value)}ms`
                : '--'}
            </Text>
            <Sparkline
              data={vitals.hrv.map((p) => p.value).slice(-12)}
              color={Colors.chartHRV}
            />
          </Card>
        </View>

        {/* AI Alert Banner */}
        {activeAlerts.length > 0 && (
          <Card
            style={[
              styles.alertCard,
              activeAlerts[0].severity === 'critical'
                ? styles.alertCardCritical
                : styles.alertCardWarning,
            ]}
            elevation="md"
            pressable
            onPress={() => {
              // Navigate to alert detail
            }}
            accessibilityRole="alert"
            accessibilityLabel={`Health alert: ${activeAlerts[0].title}`}
          >
            <View style={styles.alertContent}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 9V13M12 17H12.01M4.93 19H19.07C20.44 19 21.33 17.53 20.65 16.35L13.58 3.71C12.9 2.53 11.1 2.53 10.42 3.71L3.35 16.35C2.67 17.53 3.56 19 4.93 19Z"
                  stroke={
                    activeAlerts[0].severity === 'critical'
                      ? Colors.error
                      : Colors.warning
                  }
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>{activeAlerts[0].title}</Text>
                <Text style={styles.alertMessage} numberOfLines={2}>
                  {activeAlerts[0].message}
                </Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18L15 12L9 6" stroke={Colors.textTertiary} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
          </Card>
        )}

        {/* Check Symptoms CTA */}
        <Button
          title="Check Symptoms"
          onPress={() => {
            (navigation as any).navigate('TriageTab', { screen: 'Triage' });
          }}
          size="lg"
          fullWidth
          style={styles.ctaButton}
          leftIcon={
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 2V8C6 11.3137 8.68629 14 12 14C15.3137 14 18 11.3137 18 8V2"
                stroke={Colors.white}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <Path d="M12 14V21" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          }
          accessibilityLabel="Start symptom check"
        />

        {/* Upcoming Appointment */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
          <Pressable
            onPress={() => {
              (navigation as any).navigate('AppointmentsTab');
            }}
            accessibilityRole="link"
            accessibilityLabel="View all appointments"
          >
            <Text style={styles.sectionLink}>View All</Text>
          </Pressable>
        </View>

        <Card style={styles.appointmentCard} elevation="sm" pressable onPress={() => {}}>
          <View style={styles.appointmentContent}>
            <View style={styles.appointmentAvatar}>
              <Text style={styles.appointmentAvatarText}>DR</Text>
            </View>
            <View style={styles.appointmentInfo}>
              <Text style={styles.appointmentDoctor}>Dr. Alisher Karimov</Text>
              <Text style={styles.appointmentSpecialty}>Cardiologist</Text>
              <Text style={styles.appointmentTime}>Tomorrow, 10:00 AM</Text>
            </View>
            <Badge
              label="Confirmed"
              color={Colors.success}
              backgroundColor={Colors.successLight}
              size="sm"
            />
          </View>
        </Card>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {[
          {
            icon: 'triage',
            title: 'Symptom Check',
            subtitle: 'Moderate urgency - Cardiology',
            time: '2 hours ago',
          },
          {
            icon: 'sync',
            title: 'Wearable Sync',
            subtitle: 'Apple Watch - All metrics synced',
            time: '4 hours ago',
          },
          {
            icon: 'prescription',
            title: 'Prescription Filled',
            subtitle: 'Lisinopril 10mg - 30 tablets',
            time: 'Yesterday',
          },
        ].map((item, index) => (
          <Card
            key={index}
            style={styles.activityCard}
            elevation="none"
            pressable
            onPress={() => {}}
          >
            <View style={styles.activityContent}>
              <View style={styles.activityIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 8V16M8 12H16"
                    stroke={Colors.primary}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <View style={styles.activityText}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
          </Card>
        ))}

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
  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  greetingName: {
    ...Typography.h2,
    color: Colors.darkBlue,
  },
  greetingDate: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  healthScoreCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 132,
    height: 132,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xl,
  },
  healthScoreValue: {
    position: 'absolute',
    alignItems: 'center',
  },
  scoreNumber: {
    ...Typography.h1,
    fontSize: 32,
    fontWeight: '800',
  },
  scoreLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: -2,
  },
  healthScoreInfo: {
    flex: 1,
  },
  healthScoreTitle: {
    ...Typography.h4,
    color: Colors.darkBlue,
    marginBottom: Spacing.xs,
  },
  healthScoreDesc: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  vitalCard: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  vitalLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  vitalValue: {
    ...Typography.bodySmMedium,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  alertCard: {
    marginBottom: Spacing.lg,
  },
  alertCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    backgroundColor: Colors.warningLight,
  },
  alertCardCritical: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    ...Typography.bodySmMedium,
    color: Colors.textPrimary,
  },
  alertMessage: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  ctaButton: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.darkBlue,
  },
  sectionLink: {
    ...Typography.bodySmMedium,
    color: Colors.primary,
  },
  appointmentCard: {
    marginBottom: Spacing.xxl,
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appointmentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  appointmentAvatarText: {
    ...Typography.bodySmMedium,
    color: Colors.primary,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDoctor: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  appointmentSpecialty: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  appointmentTime: {
    ...Typography.caption,
    color: Colors.primary,
    marginTop: Spacing.xxs,
  },
  activityCard: {
    marginBottom: Spacing.sm,
    borderWidth: 0,
    backgroundColor: Colors.white,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.bodySmMedium,
    color: Colors.textPrimary,
  },
  activitySubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xxs,
  },
  activityTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  bottomSpacer: {
    height: Spacing.xxxxl,
  },
});
