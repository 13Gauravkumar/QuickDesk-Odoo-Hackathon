const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    mimetype: String
  }]
}, {
  timestamps: true
});

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Ticket subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    trim: true
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
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
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
    mimetype: String
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
  estimatedTime: Number, // in hours
  actualTime: Number, // in hours
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
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ lastActivity: -1 });

// Virtual for vote count
ticketSchema.virtual('voteCount').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Update lastActivity when ticket is modified
ticketSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Method to add comment
ticketSchema.methods.addComment = function(content, author, isInternal = false, attachments = []) {
  this.comments.push({
    content,
    author,
    isInternal,
    attachments
  });
  return this.save();
};

// Method to update status
ticketSchema.methods.updateStatus = function(newStatus, userId) {
  this.status = newStatus;
  
  if (newStatus === 'resolved') {
    this.resolvedAt = new Date();
  } else if (newStatus === 'closed') {
    this.closedAt = new Date();
  }
  
  this.addComment(`Status changed to ${newStatus}`, userId, true);
  return this.save();
};

// Method to assign ticket
ticketSchema.methods.assignTo = function(agentId, assignedBy) {
  this.assignedTo = agentId;
  this.assignedAt = new Date();
  this.addComment(`Ticket assigned to agent`, assignedBy, true);
  return this.save();
};

// Method to vote
ticketSchema.methods.vote = function(userId, voteType) {
  if (voteType === 'upvote') {
    // Remove from downvotes if exists
    this.downvotes = this.downvotes.filter(id => !id.equals(userId));
    // Add to upvotes if not already there
    if (!this.upvotes.some(id => id.equals(userId))) {
      this.upvotes.push(userId);
    }
  } else if (voteType === 'downvote') {
    // Remove from upvotes if exists
    this.upvotes = this.upvotes.filter(id => !id.equals(userId));
    // Add to downvotes if not already there
    if (!this.downvotes.some(id => id.equals(userId))) {
      this.downvotes.push(userId);
    }
  }
  return this.save();
};

module.exports = mongoose.model('Ticket', ticketSchema); 