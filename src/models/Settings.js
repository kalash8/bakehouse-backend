const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const settingsSchema = new Schema({
  restaurantId:      { type: String, default: 'default', unique: true },
  restaurantName:    { type: String, default: 'BakeHouse' },
  adminEmail:        { type: String, required: true },
  adminPasswordHash: { type: String, required: true },
  taxRate:           { type: Number, default: 5 },
  saveCustomerData:  { type: Boolean, default: false },
  tableCount:        { type: Number, default: 10 },
}, { timestamps: true });

// Helper to compare password
settingsSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.adminPasswordHash);
};

module.exports = model('Settings', settingsSchema);