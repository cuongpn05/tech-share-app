const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    enum: ['renter', 'owner', 'admin'],
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  permissions: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema, 'roles');
