const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot be more than 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot be more than 200 characters']
  },
  color: {
    type: String,
    default: '#3B82F6',
    match: [/^#[0-9A-F]{6}$/i, 'Please enter a valid hex color']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema); 