const { Schema, model, Types } = require('mongoose');

const orderItemSchema = new Schema({
  menuItem:  { type: Types.ObjectId, ref: 'MenuItem', required: true },
  name:      String,   // snapshot at time of order
  price:     Number,   // snapshot at time of order
  quantity:  { type: Number, default: 1, min: 1 },
  status:    { type: String, enum: ['pending', 'preparing', 'delivered'], default: 'pending' },
});

const orderSchema = new Schema({
  tableNumber:   { type: Number, required: true },
  sessionId:     { type: String, required: true },   // random UUID per table visit
  restaurantId:  { type: String, default: 'default' },

  // Customer data — only written if Settings.saveCustomerData is true
  customerPhone: { type: String, default: null },
  customerName:  { type: String, default: null },

  items: [orderItemSchema],

  status: {
    type: String,
    enum: ['active', 'billed', 'paid'],
    default: 'active',
  },

  subtotal:    { type: Number, default: 0 },
  taxAmount:   { type: Number, default: 0 },
  taxRate:     { type: Number, default: 5 },
  totalAmount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('Order', orderSchema);