const { Server } = require('socket.io');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    // Client kết nối sau login để gia nhập room cá nhân nhận tin mới
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('leave_user', (userId) => {
      if (userId) {
        socket.leave(`user_${userId}`);
      }
    });

    // Client tham gia phòng chat của đơn thuê cụ thể
    socket.on('join_chat', (bookingId) => {
      if (bookingId) {
        socket.join(`chat_${bookingId}`);
      }
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
