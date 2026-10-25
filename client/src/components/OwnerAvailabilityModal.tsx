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
import { isAxiosError } from 'axios';
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

type SelectionMode = 'dates' | 'range';
type RangeAction = 'block' | 'unblock';

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

const toBlockedDateRanges = (dates: string[]): BlockedDate[] => {
  const orderedDates = [...new Set(dates)].sort();
  if (orderedDates.length === 0) return [];

  const ranges: BlockedDate[] = [];
  let startDate = orderedDates[0];
  let endDate = startDate;

  orderedDates.slice(1).forEach((date) => {
    const nextDate = new Date(`${endDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    if (date === dateKey(nextDate)) {
      endDate = date;
      return;
    }

    ranges.push({ startDate, endDate, reason: 'Chủ máy bận' });
    startDate = date;
    endDate = date;
  });

  ranges.push({ startDate, endDate, reason: 'Chủ máy bận' });
  return ranges;
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
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('dates');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeAction, setRangeAction] = useState<RangeAction | null>(null);
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
    setRangeStart(null);
    setRangeAction(null);
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
    const isBlocked = selectedDates.includes(value);
    if ((value < today || bookedDates.includes(value)) && !isBlocked) return;
    setSelectedDates((previous) =>
      previous.includes(value)
        ? previous.filter((date) => date !== value)
        : [...previous, value].sort(),
    );
  };

  const selectRangeDate = (value: string) => {
    if (!rangeStart) {
      const isBlocked = selectedDates.includes(value);
      if ((value < today || bookedDates.includes(value)) && !isBlocked) return;
      setRangeStart(value);
      setRangeAction(isBlocked ? 'unblock' : 'block');
      return;
    }

    if (rangeStart === value) {
      setRangeStart(null);
      setRangeAction(null);
      return;
    }

    const startDate = rangeStart < value ? rangeStart : value;
    const endDate = rangeStart < value ? value : rangeStart;
    const rangeDates = dateKeysBetween(startDate, endDate);
    if (
      rangeAction === 'block' &&
      (value < today || bookedDates.includes(value) ||
        rangeDates.some((date) => bookedDates.includes(date)))
    ) {
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_ERROR_TITLE,
        STRINGS.AVAILABILITY.ALERT_RANGE_BOOKED,
      );
      return;
    }

    if (rangeAction === 'unblock') {
      const rangeDateSet = new Set(rangeDates);
      setSelectedDates((previous) =>
        previous.filter((date) => !rangeDateSet.has(date)),
      );
    } else {
      setSelectedDates((previous) =>
        Array.from(new Set([...previous, ...rangeDates])).sort(),
      );
    }
    setRangeStart(null);
    setRangeAction(null);
  };

  const saveAvailability = async () => {
    if (rangeStart) {
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_ERROR_TITLE,
        STRINGS.AVAILABILITY.ALERT_SELECT_RANGE,
      );
      return;
    }

    const blockedDates = toBlockedDateRanges(selectedDates);
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
      const errorMessage = isAxiosError<{ message?: unknown }>(error) &&
        typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : error instanceof Error && error.message
          ? error.message
          : STRINGS.AVAILABILITY.ALERT_ERROR_MSG;
      Alert.alert(
        STRINGS.AVAILABILITY.ALERT_ERROR_TITLE,
        errorMessage,
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
            <View style={styles.modeSwitcher}>
              {(['dates', 'range'] as const).map((mode) => {
                const isActive = selectionMode === mode;
                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      setSelectionMode(mode);
                      setRangeStart(null);
                      setRangeAction(null);
                    }}
                    style={[
                      styles.modeButton,
                      isActive && styles.activeModeButton,
                    ]}
                  >
                    <Ionicons
                      name={mode === 'dates' ? 'calendar-outline' : 'calendar'}
                      size={17}
                      color={isActive ? theme.white : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeButtonText,
                        isActive && styles.activeModeButtonText,
                      ]}
                    >
                      {mode === 'dates'
                        ? STRINGS.AVAILABILITY.MODE_SINGLE
                        : STRINGS.AVAILABILITY.MODE_RANGE}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectionMode === 'range' && (
              <View style={styles.rangeInstruction}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={theme.primaryDark}
                />
                <Text style={styles.rangeInstructionText}>
                  {rangeAction === 'unblock' && rangeStart
                    ? STRINGS.AVAILABILITY.RANGE_UNBLOCK_SELECT_END(rangeStart)
                    : rangeStart
                      ? STRINGS.AVAILABILITY.RANGE_SELECT_END(rangeStart)
                      : STRINGS.AVAILABILITY.RANGE_SELECT_START}
                </Text>
              </View>
            )}
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
              <View style={styles.calendarCard}>
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
                    const isSelected =
                      selectedDates.includes(value) || rangeStart === value;
                    const isToday = value === today;
                    const isPast = value < today;
                    const isDisabled = (isPast || isBooked) && !isSelected;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`${value}${isBooked ? ' booked' : ''}${isSelected ? ' blocked' : ''}${isToday ? ' today' : ''}`}
                        accessibilityState={{
                          selected: isSelected,
                          disabled: isDisabled,
                        }}
                        disabled={isDisabled}
                        onPress={() =>
                          selectionMode === 'dates'
                            ? toggleDate(value)
                            : selectRangeDate(value)
                        }
                        style={[
                          styles.dayCell,
                          isToday && styles.todayDay,
                          isSelected && styles.selectedDay,
                          isBooked && styles.bookedDay,
                          isPast && styles.pastDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isToday && styles.todayDayText,
                            isSelected && styles.selectedDayText,
                            isBooked && styles.bookedDayText,
                          ]}
                        >
                          {day}
                        </Text>
                        {isToday && !isSelected && !isBooked && (
                          <View style={styles.todayDot} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.blockedLegendDot]} />
                <Text style={styles.legendText}>Blocked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.bookedLegendDot]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.todayLegendDot]} />
                <Text style={styles.legendText}>Today</Text>
              </View>
            </View>

            <View style={styles.selectionSummary}>
              <View style={styles.selectionSummaryIcon}>
                <Ionicons name="calendar-clear-outline" size={20} color={theme.primaryDark} />
              </View>
              <View style={styles.selectionSummaryCopy}>
                <Text style={styles.selectionSummaryTitle}>
                  {STRINGS.AVAILABILITY.SELECTED_TITLE}
                </Text>
                <Text style={styles.selectionSummaryDescription}>
                  {selectedDates.length > 0
                    ? STRINGS.AVAILABILITY.TOTAL_DAYS(selectedDates.length)
                    : STRINGS.AVAILABILITY.NO_DATES_SELECTED}
                </Text>
              </View>
              <View style={styles.selectionCount}>
                <Text style={styles.selectionCountText}>{selectedDates.length}</Text>
              </View>
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
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  modeButton: {
    flexDirection: 'row',
    flex: 1,
    gap: theme.spacing.xs,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  activeModeButton: { backgroundColor: theme.primary },
  modeButtonText: {
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.bodySm,
    fontWeight: theme.typography.weights.semibold,
  },
  activeModeButtonText: { color: theme.white },
  rangeInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.primaryBg,
    marginBottom: theme.spacing.xs,
  },
  rangeInstructionText: {
    flex: 1,
    color: theme.primaryDark,
    fontSize: theme.typography.sizes.bodySm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.primaryLight,
  },
  monthTitle: {
    color: theme.textPrimary,
    fontSize: theme.typography.sizes.h2,
    fontWeight: theme.typography.weights.bold,
  },
  calendarCard: {
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderDefault,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radii.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginVertical: 1,
  },
  dayText: {
    color: theme.textPrimary,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
  },
  todayDay: { borderColor: theme.primary },
  todayDayText: {
    color: theme.primaryDark,
    fontWeight: theme.typography.weights.bold,
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: theme.radii.full,
    backgroundColor: theme.primary,
  },
  selectedDay: { backgroundColor: theme.primary, borderColor: theme.primary },
  selectedDayText: { color: theme.white, fontWeight: theme.typography.weights.bold },
  bookedDay: { backgroundColor: theme.warningLight, borderColor: theme.warningLight },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.primaryBg,
  },
  selectionSummaryIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.primaryLight,
  },
  selectionSummaryCopy: { flex: 1, gap: theme.spacing.xs },
  selectionSummaryTitle: {
    color: theme.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  selectionSummaryDescription: {
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.bodySm,
  },
  selectionCount: {
    minWidth: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.white,
  },
  selectionCountText: {
    color: theme.primaryDark,
    fontWeight: theme.typography.weights.bold,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: { width: 10, height: 10, borderRadius: theme.radii.full },
  blockedLegendDot: { backgroundColor: theme.primary },
  bookedLegendDot: { backgroundColor: theme.warning },
  todayLegendDot: {
    backgroundColor: theme.white,
    borderWidth: 1.5,
    borderColor: theme.primary,
  },
  legendText: {
    color: theme.textSecondary,
    fontSize: theme.typography.sizes.bodySm,
  },
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
