import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

interface RentalCountdownTimerProps {
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
}

const calculateTimeRemaining = (targetDate: string | Date): TimeRemaining => {
  const end = new Date(targetDate).getTime();
  const now = Date.now();
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
  };
};

export function RentalCountdownTimer({
  endDate,
  compact = false,
}: RentalCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeRemaining(endDate));

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(endDate));

    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(endDate));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [endDate]);

  const padZero = (num: number) => num.toString().padStart(2, '0');

  // Determine badge styling based on urgency
  let containerBg = colors.light.primaryLight;
  let borderColor = colors.light.primary;
  let statusTextColor = colors.light.primaryDark;
  let headerLabel: string = STRINGS.RENTAL_COUNTDOWN.REMAINING_TITLE;
  let iconName: any = 'timer-outline';

  if (timeLeft.isExpired) {
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
          {timeLeft.isExpired ? (
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
        {timeLeft.isExpired && (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueBadgeText}>{STRINGS.RENTAL_COUNTDOWN.OVERDUE_BADGE}</Text>
          </View>
        )}
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
});
