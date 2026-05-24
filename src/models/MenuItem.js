const { Schema, model } = require('mongoose');

const menuItemSchema = new Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price:       { type: Number, required: true, min: 0 },
  photo:       { type: String, default: '' },      // Cloudinary URL
  photoPublicId: { type: String, default: '' },    // Cloudinary public_id for deletion
  category:    { type: String, trim: true, default: 'General' },
  dietType:    { type: String, enum: ['veg', 'non-veg', 'vegan'], default: 'veg' },
  isAvailable: { type: Boolean, default: true },
  isPopular:   { type: Boolean, default: false },
  restaurantId:{ type: String, default: 'default' },
}, { timestamps: true });

// Text index for search
menuItemSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = model('MenuItem', menuItemSchema);