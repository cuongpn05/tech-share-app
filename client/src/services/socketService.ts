import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { ChatMessage } from '../types';

let socket: Socket | null = null;
let currentUserId: string | null = null;
let activeBookingId: string | null = null;

type MessageListener = (message: ChatMessage) => void;
type MessagesReadListener = (data: { bookingId: string; readBy: string }) => void;

let messageListeners: MessageListener[] = [];
let messagesReadListeners: MessagesReadListener[] = [];

export const socketService = {
  onNewMessage: (listener: MessageListener) => {
    messageListeners.push(listener);
    return () => {
      messageListeners = messageListeners.filter((l) => l !== listener);
    };
  },

  onMessagesRead: (listener: MessagesReadListener) => {
    messagesReadListeners.push(listener);
    return () => {
      messagesReadListeners = messagesReadListeners.filter((l) => l !== listener);
    };
  },

  joinChat: (bookingId: string) => {
    if (!bookingId) return;
    activeBookingId = bookingId;
    if (socket?.connected) {
      socket.emit('join_chat', bookingId);
    }
  },

  leaveChat: (bookingId: string) => {
    if (!bookingId) return;
    if (activeBookingId === bookingId) activeBookingId = null;
    if (socket?.connected) {
      socket.emit('leave_chat', bookingId);
    }
  },

  connect: (userId: string) => {
    if (!userId || (socket?.connected && currentUserId === userId)) return;
    if (socket) socket.disconnect();
    currentUserId = userId;
    const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      socket?.emit('join_user', userId);
      if (activeBookingId) socket?.emit('join_chat', activeBookingId);
    });

    socket.on('new_message', (message: ChatMessage) => {
      messageListeners.forEach((fn) => fn(message));
    });

    socket.on('messages_read', (data: { bookingId: string; readBy: string }) => {
      messagesReadListeners.forEach((fn) => fn(data));
    });
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      currentUserId = null;
    }
  },
};

export default socketService;
