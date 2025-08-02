const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    filename: String,
    originalname: String,
    size: Number,
    mimetype: String,
    path: String
  }],
  isInternal: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const timeEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  billable: {
    type: Boolean,
    default: true
  },
  rate: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const customFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'select', 'checkbox'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  }
});

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed', 'pending', 'on-hold'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent', 'critical'],
    default: 'medium'
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
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
  comments: [commentSchema],
  timeEntries: [timeEntrySchema],
  customFields: [customFieldSchema],
  attachments: [{
    filename: String,
    originalname: String,
    size: Number,
    mimetype: String,
    path: String
  }],
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  // SLA Tracking
  sla: {
    responseTime: {
      type: Number, // in hours
      default: 4
    },
    resolutionTime: {
      type: Number, // in hours
      default: 72
    },
    responseDeadline: Date,
    resolutionDeadline: Date,
    responseBreached: {
      type: Boolean,
      default: false
    },
    resolutionBreached: {
      type: Boolean,
      default: false
    }
  },
  // Time Tracking
  firstResponseAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  resolution: {
    type: String,
    trim: true
  },
  totalTimeSpent: {
    type: Number, // in minutes
    default: 0
  },
  billableTime: {
    type: Number, // in minutes
    default: 0
  },
  // Escalation
  escalated: {
    type: Boolean,
    default: false
  },
  escalatedAt: Date,
  escalatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalationReason: String,
  // Customer Satisfaction
  satisfaction: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    submittedAt: Date
  },
  // Related Tickets
  relatedTickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  }],
  parentTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  // Workflow
  workflow: {
    currentStep: {
      type: String,
      default: 'created'
    },
    steps: [{
      name: String,
      completed: Boolean,
      completedAt: Date,
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  // Automation
  automation: {
    autoAssign: {
      type: Boolean,
      default: true
    },
    autoEscalate: {
      type: Boolean,
      default: true
    },
    autoClose: {
      type: Boolean,
      default: false
    }
  },
  // Metadata
  source: {
    type: String,
    enum: ['web', 'email', 'api', 'phone', 'chat'],
    default: 'web'
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  impact: {
    type: String,
    enum: ['individual', 'department', 'organization'],
    default: 'individual'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for vote count
ticketSchema.virtual('voteCount').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Virtual for SLA status
ticketSchema.virtual('slaStatus').get(function() {
  const now = new Date();
  if (this.sla.responseDeadline && now > this.sla.responseDeadline && !this.firstResponseAt) {
    return 'response_breached';
  }
  if (this.sla.resolutionDeadline && now > this.sla.resolutionDeadline && this.status !== 'resolved' && this.status !== 'closed') {
    return 'resolution_breached';
  }
  return 'on_track';
});

// Virtual for total cost
ticketSchema.virtual('totalCost').get(function() {
  return this.timeEntries.reduce((total, entry) => {
    if (entry.billable && entry.duration && entry.rate) {
      return total + ((entry.duration / 60) * entry.rate);
    }
    return total;
  }, 0);
});

// Indexes for better performance
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ createdBy: 1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ 'sla.responseDeadline': 1 });
ticketSchema.index({ 'sla.resolutionDeadline': 1 });
ticketSchema.index({ tags: 1 });
ticketSchema.index({ subject: 'text', description: 'text' });

// Pre-save middleware to calculate SLA deadlines
ticketSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('priority') || this.isModified('category')) {
    const now = new Date();
    
    // Calculate response deadline based on priority
    const responseHours = {
      'critical': 1,
      'urgent': 2,
      'high': 4,
      'medium': 8,
      'low': 24
    };
    
    this.sla.responseDeadline = new Date(now.getTime() + (responseHours[this.priority] * 60 * 60 * 1000));
    
    // Calculate resolution deadline
    const resolutionHours = {
      'critical': 4,
      'urgent': 8,
      'high': 24,
      'medium': 72,
      'low': 168
    };
    
    this.sla.resolutionDeadline = new Date(now.getTime() + (resolutionHours[this.priority] * 60 * 60 * 1000));
  }
  
  // Update first response time
  if (this.isModified('comments') && this.comments.length > 0 && !this.firstResponseAt) {
    const agentComment = this.comments.find(comment => 
      comment.user && !comment.isInternal
    );
    if (agentComment) {
      this.firstResponseAt = agentComment.createdAt;
    }
  }
  
  // Update resolution time
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'closed')) {
    this.resolvedAt = new Date();
  }
  
  // Update closed time
  if (this.isModified('status') && this.status === 'closed') {
    this.closedAt = new Date();
  }
  
  next();
});

// Ensure virtual fields are serialized
ticketSchema.set('toJSON', { virtuals: true });
ticketSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ticket', ticketSchema); 