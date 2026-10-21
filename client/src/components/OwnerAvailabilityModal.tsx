import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STRINGS } from '../constants/strings';
import { theme } from '../constants/theme';
import { bookingService } from '../services/bookingService';
import type { BlockedDate } from '../types';

interface OwnerAvailabilityModalProps {
  visible: boolean;
  deviceName: string;
  deviceId: string;
  onClose: () => void;
  onUpdateBlockedDates: (
    deviceId: string,
    blockedDates: BlockedDate[],
  ) => Promise<void>;
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const dateKeysBetween = (start: string, end: string) => {
  const current = new Date(`${start.slice(0, 10)}T00:00:00`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00`);
  const dates: string[] = [];
  while (current <= last) {
    dates.push(dateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export function OwnerAvailabilityModal({
  visible,
  deviceName,
  deviceId,
  onClose,
  onUpdateBlockedDates,
}: OwnerAvailabilityModalProps) {
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState(false);

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const today = dateKey(new Date());
  const monthName = STRINGS.AVAILABILITY.MONTH_NAME(displayedMonth);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = useMemo(
    () => [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ],
    [daysInMonth, firstWeekday],
  );

  const loadSchedule = useCallback(async () => {
    if (!deviceId) return;
    setIsLoading(true);
    setScheduleError(false);
    setSelectedDates([]);
    setBookedDates([]);
    try {
      const schedule = await bookingService.getDeviceSchedule(deviceId);
      setBookedDates(
        schedule.bookedBookings.flatMap((booking) =>
          dateKeysBetween(booking.startDate, booking.endDate),
        ),
      );
      setSelectedDates(
        Array.from(
          new Set(
            schedule.blockedDates.flatMap((blocked) =>
              dateKeysBetween(blocked.startDate, blocked.endDate),
            ),
          ),
        ),
      );
    } catch (error) {
      console.error('[OwnerAvailabilityModal] Could not load device schedule:', error);
      setScheduleError(true);
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_ERROR_TITLE,
        STRINGS.AVAILABILITY.ALERT_ERROR_MSG,
      );
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (visible) loadSchedule();
  }, [loadSchedule, visible]);

  const toggleDate = (value: string) => {
    if (value < today || bookedDates.includes(value)) return;
    setSelectedDates((previous) =>
      previous.includes(value)
        ? previous.filter((date) => date !== value)
        : [...previous, value].sort(),
    );
  };

  const saveAvailability = async () => {
    const blockedDates = selectedDates.map((date) => ({
      startDate: date,
      endDate: date,
      reason: 'Chủ máy bận',
    }));
    setIsSaving(true);
    try {
      await onUpdateBlockedDates(deviceId, blockedDates);
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_SUCCESS_TITLE,
        STRINGS.AVAILABILITY.ALERT_SUCCESS_MSG,
      );
      onClose();
    } catch (error) {
      console.error('[OwnerAvailabilityModal] Could not save blocked dates:', error);
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_ERROR_TITLE,
        STRINGS.AVAILABILITY.ALERT_ERROR_MSG,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>{STRINGS.AVAILABILITY.MODAL_TITLE}</Text>
              <Text style={styles.deviceName} numberOfLines={1}>
                {deviceName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={STRINGS.COMMON.CLOSE}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.description}>
              {STRINGS.AVAILABILITY.DESCRIPTION}
            </Text>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel={STRINGS.AVAILABILITY.PREV_MONTH_ACCESSIBILITY}
                onPress={() => setDisplayedMonth(new Date(year, month - 1, 1))}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={22} color={theme.primary} />
              </Pressable>
              <Text style={styles.monthTitle}>
                {monthName} {year}
              </Text>
              <Pressable
                accessibilityLabel={STRINGS.AVAILABILITY.NEXT_MONTH_ACCESSIBILITY}
                onPress={() => setDisplayedMonth(new Date(year, month + 1, 1))}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-forward" size={22} color={theme.primary} />
              </Pressable>
            </View>

            {isLoading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.primary} />
                <Text style={styles.muted}>Loading device schedule...</Text>
              </View>
            ) : (
              <View style={styles.calendar}>
                {STRINGS.AVAILABILITY.WEEKDAYS.map((day) => (
                  <Text key={day} style={styles.weekday}>
                    {day}
                  </Text>
                ))}
                {calendarCells.map((day, index) => {
                  if (day === null) {
                    return <View key={`blank-${index}`} style={styles.dayCell} />;
                  }
                  const value = dateKey(new Date(year, month, day));
                  const isBooked = bookedDates.includes(value);
                  const isSelected = selectedDates.includes(value);
                  const isPast = value < today;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`${value}${isBooked ? ' booked' : ''}`}
                      accessibilityState={{
                        selected: isSelected,
                        disabled: isPast || isBooked,
                      }}
                      disabled={isPast || isBooked}
                      onPress={() => toggleDate(value)}
                      style={[
                        styles.dayCell,
                        isSelected && styles.selectedDay,
                        isBooked && styles.bookedDay,
                        isPast && styles.pastDay,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.selectedDayText,
                          isBooked && styles.bookedDayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={styles.selectionSummary}>
              {STRINGS.AVAILABILITY.TOTAL_DAYS(selectedDates.length)}
            </Text>
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
              <Text style={styles.muted}>Blocked</Text>
              <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
              <Text style={styles.muted}>Booked</Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.actionButton, styles.cancelButton]}
              disabled={isSaving}
            >
              <Text style={styles.cancelText}>{STRINGS.COMMON.CANCEL}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={saveAvailability}
              style={[styles.actionButton, styles.saveButton]}
              disabled={isLoading || isSaving || scheduleError}
            >
              {isSaving ? (
                <ActivityIndicator color={theme.white} />
              ) : (
                <Text style={styles.saveText}>
                  {STRINGS.AVAILABILITY.SAVE_CHANGES}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.overlay,
  },
  modal: {
    maxHeight: '92%',
    backgroundColor: theme.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  heading: { flex: 1 },
  title: {
    color: theme.textPrimary,
    fontSize: theme.typography.sizes.h2,
    fontWeight: theme.typography.weights.bold,
  },
  deviceName: {
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.base,
    marginTop: theme.spacing.xs,
  },
  closeButton: { padding: theme.spacing.xs },
  content: { padding: theme.spacing.md },
  description: {
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.base,
    marginBottom: theme.spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.sm,
  },
  monthButton: { padding: theme.spacing.sm },
  monthTitle: {
    color: theme.textPrimary,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  weekday: {
    width: '14.285%',
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
    paddingVertical: theme.spacing.sm,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.full,
  },
  dayText: { color: theme.textPrimary, fontSize: theme.typography.sizes.base },
  selectedDay: { backgroundColor: theme.primary },
  selectedDayText: { color: theme.white, fontWeight: theme.typography.weights.bold },
  bookedDay: { backgroundColor: theme.warningLight },
  bookedDayText: { color: theme.textSecondary },
  pastDay: { opacity: 0.35 },
  loading: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  muted: { color: theme.textSecondary, fontSize: theme.typography.sizes.bodySm },
  selectionSummary: {
    color: theme.textPrimary,
    fontWeight: theme.typography.weights.semibold,
    marginTop: theme.spacing.md,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  legendDot: { width: 12, height: 12, borderRadius: theme.radii.full },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
  },
  cancelButton: { borderWidth: 1, borderColor: theme.border },
  saveButton: { backgroundColor: theme.primary },
  cancelText: {
    color: theme.textPrimary,
    fontWeight: theme.typography.weights.semibold,
  },
  saveText: {
    color: theme.white,
    fontWeight: theme.typography.weights.bold,
  },
});
