const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a category name'],
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
    match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color']
  },
  icon: {
    type: String,
    default: 'tag'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketCount: {
    type: Number,
    default: 0
  },
  averageResolutionTime: {
    type: Number, // in hours
    default: 0
  },
  slaHours: {
    type: Number,
    default: 24 // Service Level Agreement in hours
  }
}, {
  timestamps: true
});

// Index for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1 });

// Method to update ticket count
categorySchema.methods.updateTicketCount = function() {
  const Ticket = mongoose.model('Ticket');
  return Ticket.countDocuments({ category: this._id })
    .then(count => {
      this.ticketCount = count;
      return this.save();
    });
};

// Method to update average resolution time
categorySchema.methods.updateAverageResolutionTime = function() {
  const Ticket = mongoose.model('Ticket');
  return Ticket.aggregate([
    { $match: { category: this._id, status: 'closed', resolvedAt: { $exists: true } } },
    { $project: { resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] } } },
    { $group: { _id: null, avgTime: { $avg: '$resolutionTime' } } }
  ]).then(result => {
    if (result.length > 0) {
      this.averageResolutionTime = Math.round(result[0].avgTime / (1000 * 60 * 60)); // Convert to hours
    }
    return this.save();
  });
};

// Remove sensitive fields from JSON output
categorySchema.methods.toJSON = function() {
  const category = this.toObject();
  return category;
};

module.exports = mongoose.model('Category', categorySchema); 