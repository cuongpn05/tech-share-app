import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

interface RentalCountdownTimerProps {
  startDate?: string | Date;
  endDate: string | Date;
  compact?: boolean;
}

interface TimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean; // <= 2 hours
  isWarning: boolean; // <= 6 hours
  isPendingStart: boolean; // now < startDate
}

const calculateTimeRemaining = (
  targetDate: string | Date,
  startDate?: string | Date
): TimeRemaining => {
  const end = new Date(targetDate).getTime();
  const now = Date.now();
  const start = startDate ? new Date(startDate).getTime() : 0;

  // If startDate is set and current time has not reached startDate yet:
  // Display total duration between startDate and endDate, timer has NOT started running
  if (startDate && now < start) {
    const totalRentalDiff = Math.max(0, end - start);
    const days = Math.floor(totalRentalDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((totalRentalDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((totalRentalDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalRentalDiff % (1000 * 60)) / 1000);

    return {
      totalMs: totalRentalDiff,
      days,
      hours,
      minutes,
      seconds,
      isExpired: false,
      isUrgent: false,
      isWarning: false,
      isPendingStart: true,
    };
  }

  // When current time reaches or passes startDate (now >= start): countdown timer begins running towards endDate
  const diff = end - now;

  if (diff <= 0) {
    const overdueDiff = Math.abs(diff);
    const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((overdueDiff % (1000 * 60)) / 1000);

    return {
      totalMs: diff,
      days,
      hours,
      minutes,
      seconds,
      isExpired: true,
      isUrgent: true,
      isWarning: true,
      isPendingStart: false,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const hoursRemaining = diff / (1000 * 60 * 60);

  return {
    totalMs: diff,
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    isUrgent: hoursRemaining <= 2,
    isWarning: hoursRemaining <= 6,
    isPendingStart: false,
  };
};

export function RentalCountdownTimer({
  startDate,
  endDate,
  compact = false,
}: RentalCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeRemaining(endDate, startDate));

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(endDate, startDate));

    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(endDate, startDate));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [endDate, startDate]);

  const padZero = (num: number) => num.toString().padStart(2, '0');

  // Determine badge styling based on urgency
  let containerBg = colors.light.primaryLight;
  let borderColor = colors.light.primary;
  let statusTextColor = colors.light.primaryDark;
  let headerLabel: string = STRINGS.RENTAL_COUNTDOWN.REMAINING_TITLE;
  let iconName: any = 'timer-outline';

  if (timeLeft.isPendingStart) {
    containerBg = colors.light.primaryLight + '50';
    borderColor = colors.light.primary;
    statusTextColor = colors.light.primary;
    headerLabel = STRINGS.RENTAL_COUNTDOWN.SCHEDULED_TITLE;
    iconName = 'calendar-outline';
  } else if (timeLeft.isExpired) {
    containerBg = colors.light.dangerLight;
    borderColor = colors.light.error;
    statusTextColor = colors.light.error;
    headerLabel = STRINGS.RENTAL_COUNTDOWN.OVERDUE_TITLE;
    iconName = 'alert-circle';
  } else if (timeLeft.isUrgent) {
    containerBg = colors.light.dangerLight;
    borderColor = colors.light.danger;
    statusTextColor = colors.light.danger;
    headerLabel = STRINGS.RENTAL_COUNTDOWN.URGENT_TITLE;
    iconName = 'flame';
  } else if (timeLeft.isWarning) {
    containerBg = colors.light.warningLight;
    borderColor = colors.light.warning;
    statusTextColor = colors.light.warning;
    headerLabel = STRINGS.RENTAL_COUNTDOWN.WARNING_TITLE;
    iconName = 'hourglass-outline';
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: containerBg, borderColor }]}>
        <Ionicons name={iconName} size={14} color={statusTextColor} />
        <Text style={[styles.compactText, { color: statusTextColor }]}>
          {timeLeft.isPendingStart ? (
            `${STRINGS.RENTAL_COUNTDOWN.COMPACT_SCHEDULED_PREFIX}${timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}${padZero(timeLeft.hours)}:${padZero(timeLeft.minutes)}:${padZero(timeLeft.seconds)}`
          ) : timeLeft.isExpired ? (
            `${STRINGS.RENTAL_COUNTDOWN.COMPACT_OVERDUE_PREFIX}${timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}${padZero(timeLeft.hours)}:${padZero(timeLeft.minutes)}:${padZero(timeLeft.seconds)}`
          ) : (
            `${STRINGS.RENTAL_COUNTDOWN.COMPACT_REMAINING_PREFIX}${timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}${padZero(timeLeft.hours)}:${padZero(timeLeft.minutes)}:${padZero(timeLeft.seconds)}`
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: containerBg, borderColor }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name={iconName} size={16} color={statusTextColor} />
          <Text style={[styles.headerText, { color: statusTextColor }]}>{headerLabel}</Text>
        </View>
        {timeLeft.isPendingStart ? (
          <View style={styles.scheduledBadge}>
            <Text style={styles.scheduledBadgeText}>
              {STRINGS.RENTAL_COUNTDOWN.STARTS_AT_PICKUP_BADGE}
            </Text>
          </View>
        ) : timeLeft.isExpired ? (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>{STRINGS.RENTAL_COUNTDOWN.OVERDUE_BADGE}</Text>
          </View>
        ) : null}
      </View>

      {/* Countdown Digits */}
      <View style={styles.digitContainer}>
        {/* Days Box */}
        <View style={styles.digitBox}>
          <Text style={[styles.digitNumber, { color: statusTextColor }]}>
            {padZero(timeLeft.days)}
          </Text>
          <Text style={styles.digitLabel}>{STRINGS.RENTAL_COUNTDOWN.DAYS}</Text>
        </View>

        <Text style={[styles.colon, { color: statusTextColor }]}>:</Text>

        {/* Hours Box */}
        <View style={styles.digitBox}>
          <Text style={[styles.digitNumber, { color: statusTextColor }]}>
            {padZero(timeLeft.hours)}
          </Text>
          <Text style={styles.digitLabel}>{STRINGS.RENTAL_COUNTDOWN.HOURS}</Text>
        </View>

        <Text style={[styles.colon, { color: statusTextColor }]}>:</Text>

        {/* Minutes Box */}
        <View style={styles.digitBox}>
          <Text style={[styles.digitNumber, { color: statusTextColor }]}>
            {padZero(timeLeft.minutes)}
          </Text>
          <Text style={styles.digitLabel}>{STRINGS.RENTAL_COUNTDOWN.MINS}</Text>
        </View>

        <Text style={[styles.colon, { color: statusTextColor }]}>:</Text>

        {/* Seconds Box */}
        <View style={styles.digitBox}>
          <Text style={[styles.digitNumber, { color: statusTextColor }]}>
            {padZero(timeLeft.seconds)}
          </Text>
          <Text style={styles.digitLabel}>{STRINGS.RENTAL_COUNTDOWN.SECS}</Text>
        </View>
      </View>

      {timeLeft.isPendingStart && (
        <Text style={styles.pendingStartHelper}>
          {STRINGS.RENTAL_COUNTDOWN.SCHEDULED_HELPER}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduledBadge: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scheduledBadgeText: {
    color: colors.light.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  overdueBadge: {
    backgroundColor: colors.light.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    color: colors.light.white,
    fontSize: 10,
    fontWeight: '800',
  },
  digitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  digitBox: {
    alignItems: 'center',
    backgroundColor: colors.light.white,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 46,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  digitNumber: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  digitLabel: {
    fontSize: 9,
    color: colors.light.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  colon: {
    fontSize: 16,
    fontWeight: '800',
    paddingBottom: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pendingStartHelper: {
    fontSize: 11,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
