/**
 * AppointmentsScreen
 *
 * Lists patient appointments with tabs for Upcoming and Past views.
 * Each appointment card shows doctor name, specialty, date/time,
 * location, and status badge. Upcoming cards support QR check-in
 * and cancel/reschedule. Past cards support rating and prescription
 * viewing. Includes a FAB for booking new appointments.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { AppointmentSummary } from '@aura/shared/types/appointment';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  formatDate,
  formatTime,
  formatSpecialtyName,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'upcoming' | 'past';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppointmentsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');

  const upcomingQuery = useQuery({
    queryKey: ['appointments', user?.id, 'upcoming'],
    queryFn: () => apiClient.getAppointments(user?.id || '', 'upcoming'),
    enabled: Boolean(user?.id),
  });

  const pastQuery = useQuery({
    queryKey: ['appointments', user?.id, 'past'],
    queryFn: () => apiClient.getAppointments(user?.id || '', 'past'),
    enabled: Boolean(user?.id),
  });

  const currentQuery = activeTab === 'upcoming' ? upcomingQuery : pastQuery;
  const appointments = currentQuery.data || [];

  const onRefresh = useCallback(() => {
    currentQuery.refetch();
  }, [currentQuery]);

  // ---------------------------------------------------------------------------
  // Render: Tab Bar
  // ---------------------------------------------------------------------------

  function TabBar() {
    return (
      <View style={styles.tabBar} accessibilityRole="tablist">
        {(['upcoming', 'past'] as TabKey[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={`${tab} appointments`}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
            >
              {tab === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Appointment Card
  // ---------------------------------------------------------------------------

  function renderAppointment({ item }: { item: AppointmentSummary }) {
    const isUpcoming = activeTab === 'upcoming';

    return (
      <Card style={styles.appointmentCard} elevation="sm">
        <View style={styles.cardHeader}>
          <View style={styles.doctorAvatar}>
            <Text style={styles.doctorInitials}>
              {(item.doctor_name || 'DR').substring(0, 2).toUpperCase()}
            </Text>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.doctorName} numberOfLines={1}>
              {item.doctor_name || 'Doctor'}
            </Text>
            <Text style={styles.specialty}>
              {formatSpecialtyName(item.appointment_type)}
            </Text>
          </View>

          <Badge status={item.status} size="sm" />
        </View>

        {/* Date & time */}
        <View style={styles.dateRow}>
          <View style={styles.dateItem}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M4 8C4 6.9 4.9 6 6 6H18C19.1 6 20 6.9 20 8V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V8Z" stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M4 10H20" stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M8 3V7" stroke={Colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
              <Path d="M16 3V7" stroke={Colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.dateText}>
              {formatDate(item.scheduled_start)}
            </Text>
          </View>

          <View style={styles.dateItem}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2Z" stroke={Colors.textTertiary} strokeWidth={1.5} />
              <Path d="M12 6V12L16 14" stroke={Colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
            <Text style={styles.dateText}>
              {formatTime(item.scheduled_start)} -{' '}
              {formatTime(item.scheduled_end)}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <Text style={styles.reason} numberOfLines={2}>
          {item.reason_for_visit}
        </Text>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          {isUpcoming && item.status !== 'cancelled' && (
            <>
              <Button
                title="Check-In QR"
                variant="secondary"
                size="sm"
                onPress={() => {}}
                leftIcon={
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={7} height={7} rx={1} stroke={Colors.primary} strokeWidth={1.5} />
                    <Rect x={14} y={3} width={7} height={7} rx={1} stroke={Colors.primary} strokeWidth={1.5} />
                    <Rect x={3} y={14} width={7} height={7} rx={1} stroke={Colors.primary} strokeWidth={1.5} />
                    <Path d="M14 14H17V17H14V14Z" stroke={Colors.primary} strokeWidth={1.5} />
                    <Path d="M17 20H21V17" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" />
                  </Svg>
                }
                accessibilityLabel="Show QR code for check-in"
              />
              <Button
                title="Reschedule"
                variant="ghost"
                size="sm"
                onPress={() => {}}
              />
              <Button
                title="Cancel"
                variant="ghost"
                size="sm"
                textStyle={{ color: Colors.error }}
                onPress={() => {}}
              />
            </>
          )}

          {!isUpcoming && item.status === 'completed' && (
            <>
              <Button
                title="Rate"
                variant="secondary"
                size="sm"
                onPress={() => {}}
                accessibilityLabel="Rate this appointment experience"
              />
              <Button
                title="View Prescription"
                variant="ghost"
                size="sm"
                onPress={() => {}}
              />
            </>
          )}
        </View>
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Empty State
  // ---------------------------------------------------------------------------

  function EmptyState() {
    return (
      <View style={styles.emptyContainer}>
        <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="No appointments">
          <Path d="M4 8C4 6.9 4.9 6 6 6H18C19.1 6 20 6.9 20 8V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V8Z" stroke={Colors.gray300} strokeWidth={1.5} />
          <Path d="M4 10H20" stroke={Colors.gray300} strokeWidth={1.5} />
          <Path d="M8 3V7M16 3V7" stroke={Colors.gray300} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
        <Text style={styles.emptyTitle}>
          {activeTab === 'upcoming'
            ? 'No upcoming appointments'
            : 'No past appointments'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'upcoming'
            ? 'Book an appointment to get started.'
            : 'Your appointment history will appear here.'}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <TabBar />

      <FlatList
        data={appointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={currentQuery.isLoading}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      />

      {/* FAB - Book New */}
      <Pressable
        style={styles.fab}
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel="Book a new appointment"
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5V19M5 12H19" stroke={Colors.white} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContent: {
    padding: Spacing.xxl,
    paddingBottom: 100,
  },
  separator: {
    height: Spacing.md,
  },
  appointmentCard: {
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  doctorInitials: {
    ...Typography.bodySmMedium,
    color: Colors.primary,
  },
  cardInfo: {
    flex: 1,
  },
  doctorName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  specialty: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
  },
  reason: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.section * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.lg,
  },
});
