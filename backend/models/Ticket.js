const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Please provide comment content'],
    trim: true,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  isInternal: {
    type: Boolean,
    default: false
  },
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true
});

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true,
    maxlength: [5000, 'Description cannot be more than 5000 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please provide a category']
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String
  }],
  comments: [commentSchema],
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [String],
  estimatedResolutionTime: Date,
  actualResolutionTime: Date,
  satisfactionRating: {
    type: Number,
    min: 1,
    max: 5
  },
  isEscalated: {
    type: Boolean,
    default: false
  },
  escalationReason: String,
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ createdBy: 1, createdAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ subject: 'text', description: 'text' });

// Virtual for vote count
ticketSchema.virtual('voteCount').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Virtual for comment count
ticketSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Method to update last activity
ticketSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Method to add comment
ticketSchema.methods.addComment = function(userId, content, isInternal = false, attachments = []) {
  this.comments.push({
    user: userId,
    content,
    isInternal,
    attachments
  });
  this.updateLastActivity();
  return this.save();
};

// Method to vote
ticketSchema.methods.vote = function(userId, voteType) {
  if (voteType === 'upvote') {
    // Remove from downvotes if exists
    this.downvotes = this.downvotes.filter(id => id.toString() !== userId.toString());
    // Add to upvotes if not already there
    if (!this.upvotes.includes(userId)) {
      this.upvotes.push(userId);
    }
  } else if (voteType === 'downvote') {
    // Remove from upvotes if exists
    this.upvotes = this.upvotes.filter(id => id.toString() !== userId.toString());
    // Add to downvotes if not already there
    if (!this.downvotes.includes(userId)) {
      this.downvotes.push(userId);
    }
  }
  return this.save();
};

// Method to change status
ticketSchema.methods.changeStatus = function(newStatus, userId) {
  this.status = newStatus;
  
  if (newStatus === 'resolved') {
    this.resolvedAt = new Date();
  } else if (newStatus === 'closed') {
    this.closedAt = new Date();
  }
  
  this.updateLastActivity();
  return this.save();
};

// Ensure virtual fields are serialized
ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ticket', ticketSchema); 