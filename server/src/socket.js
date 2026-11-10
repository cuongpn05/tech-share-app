const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  const { requireAuth } = require('./middlewares/authMiddleware');
  const Booking = require('./models/Booking');
  io.use((socket, next) => {
    const req = { headers: { authorization: `Bearer ${socket.handshake.auth?.token || ''}` } };
    const res = { status() { return this; }, json() { next(new Error('Authentication required')); } };
    requireAuth(req, res, () => { socket.data.userId = req.auth.id; next(); });
  });
  io.on('connection', (socket) => {
    // Client kết nối sau login để gia nhập room cá nhân nhận tin mới
    socket.on('join_user', (userId) => {
      if (String(userId) === socket.data.userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('leave_user', (userId) => {
      if (String(userId) === socket.data.userId) {
        socket.leave(`user_${userId}`);
      }
    });

    // Client tham gia phòng chat của đơn thuê cụ thể
    socket.on('join_chat', async (bookingId) => {
      if (typeof bookingId !== 'string' || !/^[a-f\d]{24}$/i.test(bookingId)) return;
      try {
        const booking = await Booking.exists({ _id: bookingId, $or: [{ ownerId: socket.data.userId }, { renterId: socket.data.userId }] });
        if (booking) socket.join(`chat_${bookingId}`);
      } catch { /* A failed authorization lookup must not join the room. */ }
    });

    socket.on('leave_chat', (bookingId) => {
      if (bookingId) {
        socket.leave(`chat_${bookingId}`);
      }
    });
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
};
