const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
  },
  isActive: { type: Boolean, default: true, index: true },
  lastLogin: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
});

accountSchema.virtual('user', {
  ref: 'User',
  localField: '_id',
  foreignField: 'accountId',
  justOne: true,
});

module.exports = mongoose.models.Account || mongoose.model('Account', accountSchema, 'accounts');
