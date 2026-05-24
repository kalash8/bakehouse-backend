let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Admin and customers join a room by restaurantId
    socket.on('join-restaurant', (restaurantId) => {
      socket.join(restaurantId);
    });

    // Customer joins their specific order room
    socket.on('join-order', (orderId) => {
      socket.join(`order-${orderId}`);
    });

    socket.on('disconnect', () => {});
  });
};

// Called from route handlers to broadcast events
const emitToRestaurant = (restaurantId, event, data) => {
  if (ioInstance) ioInstance.to(restaurantId).emit(event, data);
};

const emitToOrder = (orderId, event, data) => {
  if (ioInstance) ioInstance.to(`order-${orderId}`).emit(event, data);
};

module.exports = { initSocket, emitToRestaurant, emitToOrder };