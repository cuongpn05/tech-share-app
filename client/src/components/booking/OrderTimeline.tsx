import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { BookingTimelineItem } from '../../services/bookingService';

interface OrderTimelineProps {
  status: string;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  timeline?: BookingTimelineItem[];
}

interface StepDef {
  key: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STANDARD_STEPS: StepDef[] = [
  {
    key: 'pending',
    title: 'Placed',
    desc: 'Request sent',
    icon: 'time-outline',
  },
  {
    key: 'approved',
    title: 'Approved',
    desc: 'Owner confirmed',
    icon: 'checkmark-circle-outline',
  },
  {
    key: 'active',
    title: 'In Rent',
    desc: 'Device handover',
    icon: 'play-circle-outline',
  },
  {
    key: 'completed',
    title: 'Completed',
    desc: 'Returned & settled',
    icon: 'checkmark-done-circle-outline',
  },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  approved: 1,
  active: 2,
  completed: 3,
};

export function OrderTimeline({
  status,
  createdAt,
  startDate,
  endDate,
  timeline = [],
}: OrderTimelineProps) {
  const isCancelled = status === 'cancelled';
  const isRejected = status === 'rejected';
  const isTerminated = isCancelled || isRejected;

  const currentStepIndex = STATUS_ORDER[status] ?? (isTerminated ? 0 : 0);

  // Helper to find corresponding timeline timestamp / note
  const findTimelineInfo = (stepKey: string) => {
    const item = timeline.find((t) => t.status === stepKey);
    if (item?.timestamp) {
      const date = new Date(item.timestamp);
      return {
        timeText: date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        note: item.note,
      };
    }

    if (stepKey === 'pending' && createdAt) {
      return {
        timeText: new Date(createdAt).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    }

    if (stepKey === 'active' && startDate) {
      return {
        timeText: new Date(startDate).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
        }),
      };
    }

    if (stepKey === 'completed' && endDate) {
      return {
        timeText: new Date(endDate).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
        }),
      };
    }

    return null;
  };

  const terminatedItem = timeline.find(
    (t) => t.status === 'cancelled' || t.status === 'rejected'
  );

  return (
    <View style={styles.container}>
      {/* Horizontal Step Progression Bar */}
      <View style={styles.stepsRow}>
        {STANDARD_STEPS.map((step, index) => {
          const isPassed = !isTerminated && currentStepIndex > index;
          const isCurrent = !isTerminated && currentStepIndex === index;
          const isFuture = !isTerminated && currentStepIndex < index;

          let stepColor = colors.light.textMuted;
          let circleBg = colors.light.borderSubtle;
          let iconColor = colors.light.textMuted;
          let iconName: keyof typeof Ionicons.glyphMap = step.icon;

          if (isPassed) {
            stepColor = colors.light.success;
            circleBg = colors.light.successLight;
            iconColor = colors.light.success;
            iconName = 'checkmark';
          } else if (isCurrent) {
            stepColor = colors.light.primary;
            circleBg = colors.light.primaryLight;
            iconColor = colors.light.primary;
          } else if (isTerminated && index === 0) {
            stepColor = colors.light.textSecondary;
            circleBg = colors.light.primaryBg;
            iconColor = colors.light.primary;
          }

          const info = findTimelineInfo(step.key);

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    { backgroundColor: circleBg, borderColor: stepColor },
                    isCurrent && styles.activeCircle,
                  ]}
                >
                  <Ionicons name={iconName} size={15} color={iconColor} />
                </View>
                <Text
                  style={[
                    styles.stepTitle,
                    isCurrent && styles.activeStepTitle,
                    isPassed && { color: colors.light.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
                {info?.timeText ? (
                  <Text style={styles.stepTimeText}>{info.timeText}</Text>
                ) : (
                  <Text style={styles.stepDescText}>{step.desc}</Text>
                )}
              </View>

              {index < STANDARD_STEPS.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    {
                      backgroundColor:
                        !isTerminated && currentStepIndex > index
                          ? colors.light.success
                          : colors.light.borderDefault,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Extra notification banner when booking is Cancelled or Rejected */}
      {isTerminated && (
        <View style={styles.terminatedBanner}>
          <View style={styles.terminatedIconWrap}>
            <Ionicons name="close-circle" size={18} color={colors.light.error} />
          </View>
          <View style={styles.terminatedTextWrap}>
            <Text style={styles.terminatedTitle}>
              {isCancelled ? 'Booking Cancelled' : 'Booking Declined'}
            </Text>
            <Text style={styles.terminatedDesc}>
              {terminatedItem?.note ||
                (isCancelled
                  ? 'Booking cancelled by renter. Device availability restored.'
                  : 'Owner cannot fulfill the booking at this time.')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  activeCircle: {
    borderWidth: 2,
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  connectorLine: {
    height: 2,
    flex: 0.8,
    alignSelf: 'flex-start',
    marginTop: 15,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  activeStepTitle: {
    color: colors.light.primaryDark,
    fontWeight: '700',
  },
  stepTimeText: {
    fontSize: 10,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  stepDescText: {
    fontSize: 10,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  terminatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  terminatedIconWrap: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  terminatedTextWrap: {
    flex: 1,
  },
  terminatedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.error,
    marginBottom: 2,
  },
  terminatedDesc: {
    fontSize: 12,
    color: colors.light.textSecondary,
    lineHeight: 16,
  },
});
