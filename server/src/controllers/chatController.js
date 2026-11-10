const mongoose = require('mongoose');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Device = require('../models/Device');
const { createAndSendNotification } = require('../services/notificationService');
const { getIO } = require('../socket');
const { uploadToCloudinary } = require('../utils/cloudinary');

const userFields = 'name avatar role phone isVerified';
const chatDevice = {
  path: 'deviceId',
  select: 'name title images image brand pricePerDay status ownerId',
  populate: {
    path: 'ownerId',
    select: userFields,
    transform: (owner, id) => owner ?? id,
  },
};

const idOf = value => String(value?._id ?? value ?? '');

function getChatParticipants(booking, currentUserId) {
  const owner = booking.deviceId?.ownerId ?? booking.ownerId;
  const renterId = idOf(booking.renterId);
  const ownerId = idOf(owner);
  const isRenter = renterId === currentUserId;
  return {
    ownerId,
    renterId,
    otherUser: isRenter ? owner : booking.renterId,
    isParticipant: isRenter || ownerId === currentUserId,
    messageFilter: {
      bookingId: booking._id,
      $or: [
        { senderId: renterId, receiverId: ownerId },
        { senderId: ownerId, receiverId: renterId },
      ],
    },
  };
}

/**
 * 1. LẤY DANH SÁCH CÁC CUỘC HỘI THOẠI (GET /api/chats/conversations)
 */
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.auth?.id || req.auth?.userId || req.auth?._id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userIdObj = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    const ownedDevices = await Device.find({ ownerId: currentUserId }).select('_id').lean();

    // Tìm các đơn đặt thuê mà user hiện tại tham gia (với tư cách renter hoặc owner)
    const bookings = await Booking.find({
      $or: [
        { renterId: currentUserId },
        { ownerId: currentUserId },
        { renterId: userIdObj },
        { ownerId: userIdObj },
        { deviceId: { $in: ownedDevices.map(device => device._id) } },
      ],
    })
      .populate('renterId', userFields)
      .populate('ownerId', userFields)
      .populate(chatDevice)
      .sort({ updatedAt: -1 })
      .lean();

    const rawConversations = await Promise.all(
      bookings.map(async (b) => {
        const { isParticipant, otherUser, messageFilter } = getChatParticipants(b, String(currentUserId));
        const otherUserId = idOf(otherUser);
        if (!isParticipant || !otherUserId || otherUserId === String(currentUserId)) return null;

        // Lấy tin nhắn mới nhất trong đơn
        const lastMsg = await Message.findOne(messageFilter)
          .sort({ createdAt: -1 })
          .lean();

        // Đếm tin nhắn chưa đọc gửi tới user hiện tại
        const unreadCount = await Message.countDocuments({
          bookingId: b._id,
          senderId: otherUserId,
          receiverId: currentUserId,
          status: { $ne: 'read' },
        });

        const deviceObj = b.deviceId || {};
        const deviceTitle = deviceObj.name || deviceObj.title || 'Device';
        const deviceImage =
          deviceObj.images?.[0] ||
          deviceObj.image ||
          '';

        let lastMessageData = null;
        if (lastMsg) {
          lastMessageData = {
            _id: lastMsg._id.toString(),
            text:
              lastMsg.content ||
              (lastMsg.type === 'image'
                ? '[Photo]'
                : lastMsg.type === 'location'
                ? '[Location]'
                : '[Message]'),
            senderId: lastMsg.senderId.toString(),
            isFromMe: lastMsg.senderId.toString() === currentUserId.toString(),
            createdAt: lastMsg.createdAt
              ? lastMsg.createdAt.toISOString()
              : new Date().toISOString(),
            status: lastMsg.status || 'sent',
          };
        }

        return {
          bookingId: b._id.toString(),
          bookingCode: b.bookingCode || '',
          bookingStatus: b.status,
          otherUser: otherUser
            ? {
                _id: otherUserId,
                name: otherUser.name || 'User',
                avatar: otherUser.avatar || '',
                phone: otherUser.phone || '',
                isVerified: Boolean(otherUser.isVerified),
                role: otherUser.role || 'user',
              }
            : null,
          device: {
            _id: deviceObj._id ? deviceObj._id.toString() : '',
            title: deviceTitle,
            image: deviceImage,
            brand: deviceObj.brand || '',
          },
          lastMessage: lastMessageData,
          unreadCount,
          lastActivityAt: lastMsg ? lastMsg.createdAt : b.updatedAt || b.createdAt,
        };
      })
    );

    const conversations = rawConversations.filter(Boolean);

    // Sắp xếp: Ưu tiên cuộc hội thoại có tin nhắn mới nhất lên đầu danh sách theo thời gian thực
    conversations.sort((a, b) => {
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    console.error('[Chat Controller] Lỗi getConversations:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. LẤY LỊCH SỬ TIN NHẮN (GET /api/chats/:bookingId)
 */
const getChatHistory = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const currentUserId = req.auth?.id || req.auth?.userId || req.auth?._id;

    const booking = await Booking.findById(bookingId)
      .populate('renterId', 'name avatar role phone email isVerified')
      .populate('ownerId', 'name avatar role phone email isVerified')
      .populate(chatDevice);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const { isParticipant, ownerId, renterId, otherUser, messageFilter } =
      getChatParticipants(booking, String(currentUserId));

    if (!isParticipant && req.auth?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!ownerId || !renterId) {
      return res.status(404).json({ success: false, message: 'Chat participant not found' });
    }
    if (renterId === ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start conversation with yourself',
      });
    }

    if (isParticipant) {
      await markMessagesRead(booking._id, String(currentUserId), idOf(otherUser));
    }

    const rawMessages = await Message.find(messageFilter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    let messages = rawMessages.map((m) => ({
      _id: m._id.toString(),
      bookingId: m.bookingId.toString(),
      senderId: m.senderId.toString(),
      receiverId: m.receiverId ? m.receiverId.toString() : undefined,
      messageType: m.type === 'quick_template' ? 'template' : m.type,
      text: m.content || '',
      mediaUrl: m.mediaUrl || '',
      locationData: m.location?.latitude ? m.location : undefined,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
      status: m.status || 'sent',
    }));

    const deviceObj = booking.deviceId || {};

    return res.status(200).json({
      success: true,
      data: {
        booking: {
          _id: booking._id.toString(),
          bookingCode: booking.bookingCode || '',
          status: booking.status,
          device: booking.deviceId
            ? {
                _id: deviceObj._id ? deviceObj._id.toString() : '',
                title: deviceObj.name || deviceObj.title || '',
                image: deviceObj.images?.[0] || deviceObj.image || '',
                brand: deviceObj.brand || '',
              }
            : null,
        },
        otherUser: otherUser
          ? {
              _id: idOf(otherUser),
              name: otherUser.name || '',
              avatar: otherUser.avatar || '',
              role: otherUser.role || '',
              phone: otherUser.phone || '',
            }
          : null,
        messages,
      },
    });
  } catch (error) {
    console.error('[Chat Controller] Lỗi getChatHistory:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. GỬI TIN NHẮN MỚI (POST /api/chats/:bookingId/messages)
 */
const sendMessage = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const currentUserId = req.auth?.id || req.auth?.userId || req.auth?._id;

    const booking = await Booking.findById(bookingId).populate('deviceId', 'ownerId name title');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const { isParticipant, otherUser } = getChatParticipants(booking, String(currentUserId));
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const receiverId = idOf(otherUser);
    if (!receiverId) {
      return res.status(404).json({ success: false, message: 'Chat participant not found' });
    }
    if (String(currentUserId) === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start conversation with yourself',
      });
    }
    const { text, content, messageType = 'text', mediaUrl = '', locationData } = req.body;
    const messageContent = (text !== undefined ? text : content) || '';

    const newMessage = await Message.create({
      bookingId,
      senderId: currentUserId,
      receiverId,
      type: messageType === 'template' ? 'quick_template' : messageType,
      content: messageContent,
      mediaUrl: mediaUrl || '',
      location: locationData,
      status: 'sent',
    });

    const sender = await User.findById(currentUserId).select('name avatar role');
    const device = booking.deviceId;
    const senderDisplayName = sender?.name || 'User';
    const senderDisplayAvatar = sender?.avatar || '';
    const deviceDisplayTitle = device?.name || device?.title || 'Device';

    const savedMessageResponse = {
      _id: newMessage._id.toString(),
      bookingId: newMessage.bookingId.toString(),
      senderId: newMessage.senderId.toString(),
      receiverId: newMessage.receiverId.toString(),
      senderName: senderDisplayName,
      senderAvatar: senderDisplayAvatar,
      deviceTitle: deviceDisplayTitle,
      messageType,
      text: newMessage.content || '',
      mediaUrl: newMessage.mediaUrl || '',
      locationData: newMessage.location,
      createdAt: newMessage.createdAt ? newMessage.createdAt.toISOString() : new Date().toISOString(),
      status: newMessage.status || 'sent',
    };

    // Only the current participants receive booking chat events.
    const io = getIO();
    if (io) {
      io.to(`user_${currentUserId}`).to(`user_${receiverId}`).emit('new_message', savedMessageResponse);
      io.to(`user_${receiverId}`).emit('new_notification', {
        _id: `notif_${Date.now()}`,
        userId: receiverId.toString(),
        title: `${senderDisplayName} sent a message`,
        body:
          messageContent ||
          (messageType === 'image' ? '[Photo]' : '[GPS Location]'),
        type: 'message',
        relatedId: bookingId.toString(),
        data: {
          screen: 'ChatDetail',
          bookingId: bookingId.toString(),
          senderName: senderDisplayName,
          senderAvatar: senderDisplayAvatar,
        },
        createdAt: new Date().toISOString(),
      });
    }

    // 4. Push Notification nền
    createAndSendNotification({
      userId: receiverId,
      title: `${senderDisplayName} sent a message`,
      body:
        messageContent ||
        (messageType === 'image' ? 'Sent a photo' : 'Shared a GPS location'),
      type: 'message',
      relatedId: bookingId,
      data: { screen: 'ChatDetail', bookingId: bookingId.toString() },
    }).catch(() => {});

    return res.status(201).json({ success: true, data: savedMessageResponse });
  } catch (error) {
    console.error('[Chat Controller] Lỗi sendMessage:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. UPLOAD ẢNH CHAT (POST /api/chats/upload-image)
 */
const uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    // Tải ảnh trực tiếp lên Cloudinary với preset và cloud_name từ .env
    const secureUrl = await uploadToCloudinary(req.file, 'techshare/chats');
    if (secureUrl) {
      return res.status(200).json({
        success: true,
        data: { url: secureUrl },
      });
    }

    // Fallback: Chuyển buffer thành Base64 Data URI để render tạm thời nếu Cloudinary offline
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    return res.status(200).json({
      success: true,
      data: { url: dataUri },
    });
  } catch (error) {
    console.error('[Chat Controller] Lỗi uploadChatImage:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function markMessagesRead(bookingId, readerId, senderId) {
  const result = await Message.updateMany(
    { bookingId, senderId, receiverId: readerId, status: { $ne: 'read' } },
    { $set: { status: 'read' } }
  );

  const io = getIO();
  if (io) {
    const payload = {
      bookingId: String(bookingId),
      readBy: String(readerId),
      unreadCount: 0,
    };
    io.to(`user_${senderId}`).to(`user_${readerId}`).emit('messages_read', payload);
  }
  return result;
}

/**
 * 5. ĐÁNH DẤU ĐÃ ĐỌC (PATCH /api/chats/:bookingId/read)
 */
const markChatMessagesAsRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const currentUserId = req.auth?.id || req.auth?.userId || req.auth?._id;

    const booking = await Booking.findById(bookingId).populate('deviceId', 'ownerId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const { isParticipant, otherUser } = getChatParticipants(booking, String(currentUserId));
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Forbidden' });

    const otherUserId = idOf(otherUser);
    if (otherUserId && otherUserId !== String(currentUserId)) {
      await markMessagesRead(booking._id, String(currentUserId), otherUserId);
    }

    return res.status(200).json({
      success: true,
      message: 'Messages marked as read',
      data: {
        bookingId: String(bookingId),
        unreadCount: 0,
      },
    });
  } catch (error) {
    console.error('[Chat Controller] Lỗi markChatMessagesAsRead:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getConversations,
  getChatHistory,
  sendMessage,
  uploadChatImage,
  markChatMessagesAsRead,
};
