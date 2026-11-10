import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AxiosError } from 'axios';
import { theme } from '../../theme/tokens';
import { EXTENSION_REQUEST_STRINGS as STRINGS } from '../../constants/extensionRequestStrings';
import {
  bookingService,
  Booking,
  ExtensionRequestStatus,
} from '../../services/bookingService';

type Props = {
  navigation?: any;
};

const filters: ExtensionRequestStatus[] = ['pending', 'approved', 'rejected', 'all'];
const dayInMilliseconds = 24 * 60 * 60 * 1000;

const getApiError = (error: unknown) => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message || error.message || STRINGS.MESSAGES.ACTION_ERROR;
  }
  return error instanceof Error ? error.message : STRINGS.MESSAGES.ACTION_ERROR;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatAmount = (value?: number) => (
  `${Number(value || 0).toLocaleString('en-US')} VND`
);

const getRequestDate = (booking: Booking) => {
  const timelineRequest = booking.timeline
    ?.filter((item) => item.status === 'extension_requested')
    .slice(-1)[0];
  return booking.extensionRequest?.requestedAt || timelineRequest?.timestamp || booking.createdAt;
};

const getOriginalEndDate = (booking: Booking) => {
  const requestedEndDate = booking.extensionRequest?.requestedEndDate;
  const requestedDays = booking.extensionRequest?.requestedDays || 0;
  if (requestedEndDate && requestedDays > 0) {
    const date = new Date(requestedEndDate);
    if (!Number.isNaN(date.getTime())) {
      return new Date(date.getTime() - requestedDays * dayInMilliseconds).toISOString();
    }
  }
  return booking.endDate;
};

const statusColor = (status?: string) => {
  if (status === 'approved') return { background: theme.colors.successLight, text: theme.colors.success };
  if (status === 'rejected') return { background: theme.colors.dangerLight, text: theme.colors.danger };
  return { background: theme.colors.warningLight, text: theme.colors.warning };
};

const statusLabel = (status?: string) => {
  if (status === 'approved') return STRINGS.STATUS.APPROVED;
  if (status === 'rejected') return STRINGS.STATUS.REJECTED;
  return STRINGS.STATUS.PENDING;
};

const ExtensionRequestsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const [status, setStatus] = useState<ExtensionRequestStatus>('pending');
  const [requests, setRequests] = useState<Booking[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadRequests = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setErrorMessage('');
    try {
      const data = await bookingService.getExtensionRequests(status);
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorMessage(getApiError(error) || STRINGS.MESSAGES.LOAD_ERROR);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const openDetails = async (booking: Booking) => {
    try {
      const details = await bookingService.getExtensionRequestById(booking._id);
      setSelectedRequest(details);
    } catch (error) {
      Alert.alert(STRINGS.HEADER, getApiError(error));
    }
  };

  const processRequest = async (booking: Booking, action: 'approve' | 'reject') => {
    try {
      setProcessingId(booking._id);
      if (action === 'approve') {
        await bookingService.approveExtensionRequest(booking._id);
        Alert.alert(STRINGS.ACTIONS.APPROVE, STRINGS.MESSAGES.APPROVED);
      } else {
        await bookingService.rejectExtensionRequest(booking._id);
        Alert.alert(STRINGS.ACTIONS.REJECT, STRINGS.MESSAGES.REJECTED);
      }
      if (selectedRequest?._id === booking._id) setSelectedRequest(null);
      await loadRequests(false);
    } catch (error) {
      Alert.alert(STRINGS.HEADER, getApiError(error));
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDecision = (booking: Booking, action: 'approve' | 'reject') => {
    const isApprove = action === 'approve';
    Alert.alert(
      isApprove ? STRINGS.CONFIRM.APPROVE_TITLE : STRINGS.CONFIRM.REJECT_TITLE,
      isApprove ? STRINGS.CONFIRM.APPROVE_BODY : STRINGS.CONFIRM.REJECT_BODY,
      [
        { text: STRINGS.CONFIRM.CANCEL, style: 'cancel' },
        {
          text: isApprove ? STRINGS.CONFIRM.CONFIRM_APPROVE : STRINGS.CONFIRM.CONFIRM_REJECT,
          style: isApprove ? 'default' : 'destructive',
          onPress: () => { void processRequest(booking, action); },
        },
      ]
    );
  };

  const renderRequest = ({ item }: { item: Booking }) => {
    const badge = statusColor(item.extensionRequest?.status);
    const customerName = item.renterId?.name || item.renterId?.username || STRINGS.MESSAGES.UNKNOWN_CUSTOMER;
    const deviceName = item.deviceId?.name || STRINGS.MESSAGES.UNKNOWN_DEVICE;
    const isPending = item.extensionRequest?.status === 'pending';
    const isProcessing = processingId === item._id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeading}>
            <Text style={styles.requestId}>
              {STRINGS.FIELDS.REQUEST_ID}: {item._id}
            </Text>
            <Text style={styles.bookingCode}>{item.bookingCode || item._id}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.background }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {statusLabel(item.extensionRequest?.status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardRule} />
        <InfoRow label={STRINGS.FIELDS.CUSTOMER} value={customerName} />
        <InfoRow label={STRINGS.FIELDS.DEVICE} value={deviceName} />
        <InfoRow label={STRINGS.FIELDS.CURRENT_END} value={formatDate(item.endDate)} />
        <InfoRow
          label={STRINGS.FIELDS.REQUESTED_DAYS}
          value={`${item.extensionRequest?.requestedDays || 0} day(s)`}
        />
        <InfoRow
          label={STRINGS.FIELDS.PROPOSED_END}
          value={formatDate(item.extensionRequest?.requestedEndDate)}
        />
        <InfoRow
          label={STRINGS.FIELDS.SURCHARGE}
          value={formatAmount(item.extensionRequest?.additionalFee)}
          emphasize
        />
        <InfoRow label={STRINGS.FIELDS.SUBMITTED} value={formatDate(getRequestDate(item))} />

        <TouchableOpacity style={styles.detailsButton} onPress={() => { void openDetails(item); }}>
          <Ionicons name="reader-outline" size={17} color={theme.colors.brand[500]} />
          <Text style={styles.detailsButtonText}>{STRINGS.ACTIONS.DETAILS}</Text>
        </TouchableOpacity>

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              disabled={isProcessing}
              onPress={() => confirmDecision(item, 'reject')}
            >
              {isProcessing
                ? <ActivityIndicator size="small" color={theme.colors.text.secondary} />
                : <Text style={styles.rejectButtonText}>{STRINGS.ACTIONS.REJECT}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              disabled={isProcessing}
              onPress={() => confirmDecision(item, 'approve')}
            >
              {isProcessing
                ? <ActivityIndicator size="small" color={theme.colors.white} />
                : <Text style={styles.approveButtonText}>{STRINGS.ACTIONS.APPROVE}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          style={styles.menuButton}
          onPress={() => navigation?.openDrawer?.()}
        >
          <Ionicons name="menu-outline" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{STRINGS.HEADER}</Text>
          <Text style={styles.headerSubtitle}>{STRINGS.SUBTITLE}</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        {filters.map((filter) => {
          const label = filter === 'all'
            ? STRINGS.FILTERS.ALL
            : STRINGS.FILTERS[filter.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED'];
          return (
            <Pressable
              key={filter}
              style={[styles.filterButton, status === filter && styles.filterButtonActive]}
              onPress={() => setStatus(filter)}
            >
              <Text style={[styles.filterText, status === filter && styles.filterTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage || STRINGS.MESSAGES.LOAD_ERROR}</Text>
          <TouchableOpacity onPress={() => { void loadRequests(); }}>
            <Text style={styles.retryText}>{STRINGS.ACTIONS.RETRY}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
          <Text style={styles.stateText}>{STRINGS.MESSAGES.LOADING}</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item._id}
          contentContainerStyle={requests.length ? styles.listContent : styles.emptyListContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadRequests(false);
              }}
              tintColor={theme.colors.brand[500]}
            />
          }
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={42} color={theme.colors.text.muted} />
              <Text style={styles.emptyText}>{STRINGS.MESSAGES.EMPTY}</Text>
            </View>
          )}
        />
      )}

      <Modal
        visible={selectedRequest !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRequest(null)}
      >
        {selectedRequest && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.modalTitle}>{STRINGS.ACTIONS.DETAILS}</Text>
                  <Text style={styles.modalSubtitle}>
                    {STRINGS.FIELDS.REQUEST_ID}: {selectedRequest._id}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={STRINGS.ACTIONS.CLOSE}
                  onPress={() => setSelectedRequest(null)}
                >
                  <Ionicons name="close" size={25} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <InfoRow
                  label={STRINGS.FIELDS.STATUS}
                  value={statusLabel(selectedRequest.extensionRequest?.status)}
                />
                <InfoRow
                  label={STRINGS.FIELDS.CUSTOMER}
                  value={selectedRequest.renterId?.name || selectedRequest.renterId?.username || STRINGS.MESSAGES.UNKNOWN_CUSTOMER}
                />
                {selectedRequest.renterId?.email ? (
                  <InfoRow label={STRINGS.FIELDS.EMAIL} value={selectedRequest.renterId.email} />
                ) : null}
                {selectedRequest.renterId?.phone ? (
                  <InfoRow label={STRINGS.FIELDS.PHONE} value={selectedRequest.renterId.phone} />
                ) : null}
                <InfoRow
                  label={STRINGS.FIELDS.BOOKING}
                  value={selectedRequest.bookingCode || selectedRequest._id}
                />
                <InfoRow
                  label={STRINGS.FIELDS.DEVICE}
                  value={selectedRequest.deviceId?.name || STRINGS.MESSAGES.UNKNOWN_DEVICE}
                />
                <InfoRow
                  label={STRINGS.FIELDS.ORIGINAL_PERIOD}
                  value={`${formatDate(selectedRequest.startDate)} – ${formatDate(getOriginalEndDate(selectedRequest))}`}
                />
                <InfoRow
                  label={STRINGS.FIELDS.CURRENT_END}
                  value={formatDate(selectedRequest.endDate)}
                />
                <InfoRow
                  label={STRINGS.FIELDS.REQUESTED_DAYS}
                  value={`${selectedRequest.extensionRequest?.requestedDays || 0} day(s)`}
                />
                <InfoRow
                  label={STRINGS.FIELDS.PROPOSED_END}
                  value={formatDate(selectedRequest.extensionRequest?.requestedEndDate)}
                />
                {selectedRequest.extensionRequest?.status === 'approved' && (
                  <InfoRow
                    label={STRINGS.FIELDS.UPDATED_END}
                    value={formatDate(selectedRequest.endDate)}
                    emphasize
                  />
                )}
                <InfoRow
                  label={STRINGS.FIELDS.SURCHARGE}
                  value={formatAmount(selectedRequest.extensionRequest?.additionalFee)}
                  emphasize
                />
                <InfoRow
                  label={STRINGS.FIELDS.SUBMITTED}
                  value={formatDate(getRequestDate(selectedRequest))}
                />
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedRequest(null)}>
                <Text style={styles.modalCloseText}>{STRINGS.ACTIONS.CLOSE}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const InfoRow: React.FC<{ label: string; value: string; emphasize?: boolean }> = ({
  label,
  value,
  emphasize = false,
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, emphasize && styles.infoValueEmphasized]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  menuButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: theme.colors.text.muted,
    fontSize: 12,
    marginTop: 3,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.brand[500],
    borderColor: theme.colors.brand[500],
  },
  filterText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: theme.colors.white,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeading: {
    flex: 1,
    marginRight: 10,
  },
  requestId: {
    color: theme.colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  bookingCode: {
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardRule: {
    height: 1,
    backgroundColor: theme.colors.border.light,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    color: theme.colors.text.muted,
    fontSize: 12,
  },
  infoValue: {
    flex: 1.15,
    color: theme.colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  infoValueEmphasized: {
    color: theme.colors.brand[500],
    fontWeight: '700',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.brand[50],
  },
  detailsButtonText: {
    color: theme.colors.brand[600],
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  rejectButton: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  rejectButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  approveButton: {
    backgroundColor: theme.colors.brand[500],
  },
  approveButtonText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: theme.colors.text.muted,
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: theme.colors.text.muted,
    fontSize: 14,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.errorLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    color: theme.colors.error,
    fontSize: 12,
  },
  retryText: {
    color: theme.colors.brand[600],
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.backdrop,
  },
  modalCard: {
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: theme.colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalTitle: {
    color: theme.colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: theme.colors.text.muted,
    fontSize: 11,
    marginTop: 4,
  },
  modalContent: {
    paddingVertical: 12,
  },
  modalCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  modalCloseText: {
    color: theme.colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ExtensionRequestsScreen;
