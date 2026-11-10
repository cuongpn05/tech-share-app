import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/tokens';
import { ConversationListItem, ConversationListItemData } from '../../components/chat/ConversationListItem';
import { ConversationListSkeleton } from '../../components/common/ShimmerPlaceholders';
import { useConversations } from './useConversations';
import { notificationService } from '../../services/notificationService';

export interface MessagesScreenProps {
  navigation?: any;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const bottomInset = Math.max(insets.bottom, 24);

  const {
    filteredConversations,
    isLoading,
    refreshing,
    isError,
    errorMessage,
    searchQuery,
    setSearchQuery,
    onRefresh,
    retry,
    markLocallyAsRead,
  } = useConversations();

  const [unreadNotifCount, setUnreadNotifCount] = React.useState(
    notificationService.getUnreadCountCached()
  );

  React.useEffect(() => {
    const unsub = notificationService.onUnreadCountChange((count) => {
      setUnreadNotifCount(count);
    });
    return unsub;
  }, []);

  const handleOpenConversation = (item: ConversationListItemData) => {
    markLocallyAsRead(item.bookingId);
    if (navigation?.navigate) {
      navigation.navigate('ChatDetail', {
        bookingId: item.bookingId,
      });
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const handleNavigateNotifications = () => {
    if (navigation?.navigate) {
      navigation.navigate('Notification');
    }
  };

  return (
    <View style={[styles.screenContainer, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeftRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.headerIconButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          )}

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>Your conversations</Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={styles.notificationButton}
          onPress={handleNavigateNotifications}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={theme.colors.text.primary}
          />
          {unreadNotifCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.colors.text.subtle}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={theme.colors.text.subtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.colors.text.subtle}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Error Banner / State */}
      {isError && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={36}
            color={theme.colors.text.muted}
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>Unable to load conversations</Text>
          <Text style={styles.errorSubtitle}>
            {errorMessage || 'Check your internet connection and try again.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={retry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Conversation List */}
      {isLoading && filteredConversations.length === 0 ? (
        <ConversationListSkeleton count={6} />
      ) : !isError && (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ConversationListItem
              item={item}
              onPress={() => handleOpenConversation(item)}
              showDivider={index < filteredConversations.length - 1}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomInset + 20 },
            filteredConversations.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.brand[500]]}
              tintColor={theme.colors.brand[500]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={searchQuery.trim().length > 0 ? 'search-outline' : 'chatbubbles-outline'}
                  size={36}
                  color={theme.colors.text.subtle}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery.trim().length > 0
                  ? 'No conversations found'
                  : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.trim().length > 0
                  ? `No matches found for "${searchQuery}".`
                  : 'Your conversations with tech owners and renters will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.surfaceMuted,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: theme.colors.text.muted,
    marginTop: 1,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: theme.colors.brand[500],
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: theme.typography.fontWeight.bold,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: theme.colors.text.primary,
    paddingVertical: 0,
  },
  listContent: {
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
  },
  listContentEmpty: {
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  errorIcon: {
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 16.5,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 13.5,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.brand[500],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: theme.colors.brand[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

export default MessagesScreen;
