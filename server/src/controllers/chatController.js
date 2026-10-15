const mongoose = require('mongoose');
const Message = require('../models/Message');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Device = require('../models/Device');
const { createAndSendNotification } = require('../services/notificationService');
const { getIO } = require('../socket');

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

    // Tìm các đơn đặt thuê mà user hiện tại tham gia (với tư cách renter hoặc owner)
    const bookings = await Booking.find({
      $or: [
        { renterId: currentUserId },
        { ownerId: currentUserId },
        { renterId: userIdObj },
        { ownerId: userIdObj },
      ],
    })
      .populate('renterId', 'name avatar role phone isVerified')
      .populate('ownerId', 'name avatar role phone isVerified')
      .populate('deviceId', 'name title images image brand pricePerDay status')
      .sort({ updatedAt: -1 })
      .lean();

    const rawConversations = await Promise.all(
      bookings.map(async (b) => {
        const renterIdStr = (b.renterId?._id || b.renterId || '').toString();
        const ownerIdStr = (b.ownerId?._id || b.ownerId || '').toString();
        const currentUserIdStr = currentUserId.toString();

        // 1. Chặn chat với chính mình nếu renter === owner
        if (renterIdStr && ownerIdStr && renterIdStr === ownerIdStr) {
          return null;
        }

        const isRenter = renterIdStr === currentUserIdStr;
        const otherUser = isRenter ? b.ownerId : b.renterId;
        const otherUserIdStr = (otherUser?._id || otherUser || '').toString();

        // 2. Chặn nếu đối phương trùng với tài khoản hiện tại
        if (otherUserIdStr && otherUserIdStr === currentUserIdStr) {
          return null;
        }

        // Lấy tin nhắn mới nhất trong đơn
        const lastMsg = await Message.findOne({ bookingId: b._id })
          .sort({ createdAt: -1 })
          .lean();

        // Đếm tin nhắn chưa đọc gửi tới user hiện tại
        const unreadCount = await Message.countDocuments({
          bookingId: b._id,
          $or: [{ receiverId: currentUserId }, { receiverId: userIdObj }],
          status: { $ne: 'read' },
        });

        const deviceObj = b.deviceId || {};
        const deviceTitle = deviceObj.name || deviceObj.title || 'Thiết bị';
        const deviceImage =
          deviceObj.images?.[0] ||
          deviceObj.image ||
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800';

        let lastMessageData = null;
        if (lastMsg) {
          lastMessageData = {
            _id: lastMsg._id.toString(),
            text:
              lastMsg.content ||
              (lastMsg.type === 'image'
                ? '[Hình ảnh]'
                : lastMsg.type === 'location'
                ? '[Vị trí]'
                : '[Tin nhắn]'),
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
                _id: otherUser._id ? otherUser._id.toString() : '',
                name: otherUser.name || 'Người dùng',
                avatar:
                  otherUser.avatar ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
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
      .populate('deviceId', 'name title images image brand pricePerDay status');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isRenter = booking.renterId?._id?.toString() === currentUserId.toString();
    const isOwner = booking.ownerId?._id?.toString() === currentUserId.toString();
    const isAdmin = req.auth?.role === 'admin';

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const renterIdStr = (booking.renterId?._id || booking.renterId || '').toString();
    const ownerIdStr = (booking.ownerId?._id || booking.ownerId || '').toString();
    if (renterIdStr && ownerIdStr && renterIdStr === ownerIdStr) {
      return res.status(400).json({
        success: false,
        message: 'Không thể thực hiện cuộc trò chuyện với chính mình',
      });
    }

    const otherUser = isRenter ? booking.ownerId : booking.renterId;
    const userIdObj = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    // Đánh dấu đã đọc các tin nhắn gửi đến currentUserId
    await Message.updateMany(
      {
        bookingId: booking._id,
        $or: [{ receiverId: currentUserId }, { receiverId: userIdObj }],
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } }
    );

    // Emit socket thông báo đã đọc
    const io = getIO();
    if (io) {
      io.to(`chat_${booking._id}`).emit('messages_read', {
        bookingId: String(booking._id),
        readBy: String(currentUserId),
      });
    }

    const rawMessages = await Message.find({ bookingId })
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
              _id: otherUser._id.toString(),
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

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isRenter = booking.renterId.toString() === currentUserId.toString();
    const isOwner = booking.ownerId.toString() === currentUserId.toString();

    if (!isRenter && !isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const receiverId = isRenter ? booking.ownerId : booking.renterId;

    // Chặn chat với chính mình
    if (
      String(currentUserId) === String(receiverId) ||
      String(booking.renterId) === String(booking.ownerId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Không thể thực hiện cuộc trò chuyện với chính mình',
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
    const device = booking.deviceId ? await Device.findById(booking.deviceId).select('name title') : null;
    const senderDisplayName = sender?.name || 'Người dùng';
    const senderDisplayAvatar = sender?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';
    const deviceDisplayTitle = device?.name || device?.title || 'Thiết bị';

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

    // 4. Phân phối Real-time qua Socket.IO tới room chat và room người nhận (ghép to() để deduplicate socket)
    const io = getIO();
    if (io) {
      io.to(`chat_${bookingId}`).to(`user_${receiverId}`).emit('new_message', savedMessageResponse);
      io.to(`user_${receiverId}`).emit('new_notification', {
        _id: `notif_${Date.now()}`,
        userId: receiverId.toString(),
        title: `${senderDisplayName} đã gửi tin nhắn`,
        body:
          messageContent ||
          (messageType === 'image' ? '[Hình ảnh]' : '[Vị trí GPS]'),
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
      title: `${senderDisplayName} đã gửi tin nhắn`,
      body:
        messageContent ||
        (messageType === 'image' ? 'Đã gửi một hình ảnh' : 'Đã chia sẻ vị trí GPS'),
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

    // Nếu có cấu hình Cloudinary ENV, upload trực tiếp lên Cloudinary API
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      try {
        const crypto = require('crypto');
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = crypto
          .createHash('sha1')
          .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
          .digest('hex');

        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'image/jpeg' });
        formData.append('file', blob);
        formData.append('api_key', process.env.CLOUDINARY_API_KEY);
        formData.append('timestamp', String(timestamp));
        formData.append('signature', signature);

        const cldRes = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: 'POST', body: formData }
        );
        const cldJson = await cldRes.json();
        if (cldJson.secure_url) {
          return res.status(200).json({
            success: true,
            data: { url: cldJson.secure_url },
          });
        }
      } catch (cldErr) {
        console.warn('[Chat Controller] Cloudinary upload fallback to data URI:', cldErr.message);
      }
    }

    // Chuyển buffer thành Base64 Data URI để render ngay lập tức trên app
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

/**
 * 5. ĐÁNH DẤU ĐÃ ĐỌC (PATCH /api/chats/:bookingId/read)
 */
const markChatMessagesAsRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const currentUserId = req.auth?.id || req.auth?.userId || req.auth?._id;

    const userIdObj = mongoose.Types.ObjectId.isValid(currentUserId)
      ? new mongoose.Types.ObjectId(currentUserId)
      : currentUserId;

    await Message.updateMany(
      {
        bookingId,
        $or: [{ receiverId: currentUserId }, { receiverId: userIdObj }],
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } }
    );

    const io = getIO();
    if (io) {
      io.to(`chat_${bookingId}`).emit('messages_read', {
        bookingId: String(bookingId),
        readBy: String(currentUserId),
      });
    }

    return res.status(200).json({ success: true, message: 'Messages marked as read' });
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
