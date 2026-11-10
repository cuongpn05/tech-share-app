import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '../../store';
import { chatService } from '../../services/chatService';
import { socketService } from '../../services/socketService';
import { ChatMessage, ChatConversationItem } from '../../types';
import { ConversationListItemData } from '../../components/chat/ConversationListItem';

export const formatConversationTime = (isoString?: string): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  if (date.getFullYear() === now.getFullYear()) {
    return `${day}/${month}`;
  }
  return `${day}/${month}/${String(date.getFullYear()).slice(-2)}`;
};

export const useConversations = () => {
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?._id || (currentUser as any)?.id || '';

  const [rawConversations, setRawConversations] = useState<ChatConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSelfUser = useCallback(
    (otherId?: string | null, otherName?: string | null): boolean => {
      if (!currentUser) return false;
      const myId = String(currentUser._id || (currentUser as any).id || currentUserId || '').trim();
      const myName = (currentUser.name || '').trim().toLowerCase();
      const myUsername = ((currentUser as any).username || '').trim().toLowerCase();

      if (otherId && myId && String(otherId).trim() === myId) return true;
      if (otherName) {
        const norm = otherName.trim().toLowerCase();
        if (myName && norm === myName) return true;
        if (myUsername && norm === myUsername) return true;
      }
      return false;
    },
    [currentUser, currentUserId]
  );

  const fetchConversations = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setIsError(false);
      setErrorMessage(null);

      try {
        const data = await chatService.getConversations();
        if (Array.isArray(data)) {
          setRawConversations(data);
        } else {
          setRawConversations([]);
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Unable to load conversations. Please try again.';
        console.warn('[useConversations] fetch error:', msg);
        setIsError(true);
        setErrorMessage('Unable to load conversations. Check your connection and try again.');
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Fetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations(false);
    }, [fetchConversations])
  );

  // Socket connection & real-time updates
  useEffect(() => {
    if (currentUserId) {
      socketService.connect(currentUserId);
    }

    const unsubNewMsg = socketService.onNewMessage((incomingMsg: ChatMessage) => {
      setRawConversations((prev) => {
        const index = prev.findIndex((c) => c.bookingId === incomingMsg.bookingId);
        const isFromMe = String(incomingMsg.senderId) === String(currentUserId);

        const newLastMsg = {
          _id: incomingMsg._id,
          text:
            incomingMsg.text ||
            (incomingMsg.messageType === 'image'
              ? '[Image]'
              : incomingMsg.messageType === 'location'
              ? '[Location]'
              : 'New message'),
          senderId: incomingMsg.senderId,
          isFromMe,
          createdAt: incomingMsg.createdAt,
          status: incomingMsg.status || 'sent',
        };

        if (index === -1) {
          // New conversation thread - trigger refetch in background
          fetchConversations(true);
          return prev;
        }

        const target = prev[index];
        const updatedItem: ChatConversationItem = {
          ...target,
          lastMessage: newLastMsg,
          unreadCount: isFromMe ? target.unreadCount : (target.unreadCount || 0) + 1,
          lastActivityAt: incomingMsg.createdAt,
        };

        const withoutTarget = prev.filter((_, i) => i !== index);
        return [updatedItem, ...withoutTarget];
      });
    });

    const unsubRead = socketService.onMessagesRead((data: { bookingId: string }) => {
      setRawConversations((prev) =>
        prev.map((c) =>
          c.bookingId === data.bookingId ? { ...c, unreadCount: 0 } : c
        )
      );
    });

    return () => {
      unsubNewMsg();
      unsubRead();
    };
  }, [fetchConversations, currentUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations(true);
  }, [fetchConversations]);

  const retry = useCallback(async () => {
    await fetchConversations(false);
  }, [fetchConversations]);

  // Transform and deduplicate raw conversations into unified Messenger-style list items
  const conversations: ConversationListItemData[] = useMemo(() => {
    if (!Array.isArray(rawConversations)) return [];

    // 1. Filter out self-chat items
    const valid = rawConversations.filter((item) => {
      const otherId = item.otherUser?._id;
      const otherName = item.otherUser?.name;
      return !isSelfUser(otherId, otherName);
    });

    // 2. Group by counterpart user (id or normalized name)
    const groups = new Map<string, ChatConversationItem[]>();
    for (const item of valid) {
      const otherId = item.otherUser?._id ? String(item.otherUser._id).trim() : '';
      const otherName = item.otherUser?.name ? item.otherUser.name.trim().toLowerCase() : '';
      const key = otherId ? `id_${otherId}` : otherName ? `name_${otherName}` : `booking_${item.bookingId}`;

      const existing = groups.get(key);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }
    }

    // 3. Select representative booking & aggregate unread counts
    const list: ConversationListItemData[] = [];

    for (const [, group] of groups.entries()) {
      if (group.length === 0) continue;

      // Sort within the counterpart group by lastActivityAt descending
      const sorted = [...group].sort((a, b) => {
        const timeA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const timeB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return timeB - timeA;
      });

      const representative = sorted[0];
      const totalUnread = group.reduce((sum, b) => sum + (b.unreadCount || 0), 0);

      const latestTime = sorted[0].lastActivityAt;
      const lastMsgObj = sorted[0].lastMessage;

      let snippet = lastMsgObj?.text;
      if (!snippet) {
        snippet = 'Start a conversation';
      }

      const otherUserName = representative.otherUser?.name || 'User';

      list.push({
        id: representative.bookingId,
        bookingId: representative.bookingId,
        user: {
          id: representative.otherUser?._id || '',
          name: otherUserName,
          avatar: representative.otherUser?.avatar || '',
          isVerified: Boolean(representative.otherUser?.isVerified),
        },
        lastMessage: snippet,
        timeFormatted: formatConversationTime(latestTime),
        unreadCount: totalUnread,
        isFromMe: Boolean(lastMsgObj?.isFromMe),
      });
    }

    // 4. Sort all conversations by latest message/activity
    list.sort((a, b) => {
      // Find original timestamps for accurate compare
      const origA = rawConversations.find((c) => c.bookingId === a.bookingId)?.lastActivityAt;
      const origB = rawConversations.find((c) => c.bookingId === b.bookingId)?.lastActivityAt;
      const timeA = origA ? new Date(origA).getTime() : 0;
      const timeB = origB ? new Date(origB).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [rawConversations, isSelfUser]);

  // Search filter applied on counterpart name and last message
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter(
      (c) =>
        c.user.name.toLowerCase().includes(query) ||
        c.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Optimistic mark as read on item press
  const markLocallyAsRead = useCallback((bookingId: string) => {
    setRawConversations((prev) =>
      prev.map((c) =>
        c.bookingId === bookingId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, []);

  return {
    conversations,
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
  };
};
