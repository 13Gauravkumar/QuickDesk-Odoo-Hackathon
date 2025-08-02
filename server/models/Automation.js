const mongoose = require('mongoose');

const conditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed
});

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['assign_ticket', 'change_status', 'change_priority', 'add_tag', 'remove_tag', 'send_email', 'send_notification', 'escalate_ticket', 'add_comment', 'update_custom_field'],
    required: true
  },
  parameters: {
    assignTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: String,
    priority: String,
    tag: String,
    emailTemplate: String,
    notificationMessage: String,
    comment: String,
    customField: {
      name: String,
      value: mongoose.Schema.Types.Mixed
    }
  }
});

const automationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  trigger: {
    type: {
      type: String,
      enum: ['ticket_created', 'ticket_updated', 'comment_added', 'status_changed', 'priority_changed', 'assigned_changed', 'time_based', 'sla_breached'],
      required: true
    },
    conditions: [conditionSchema],
    schedule: {
      type: String, // Cron expression for time-based triggers
      default: null
    }
  },
  conditions: [conditionSchema],
  actions: [actionSchema],
  // Execution settings
  isActive: {
    type: Boolean,
    default: true
  },
  executionOrder: {
    type: Number,
    default: 0
  },
  maxExecutions: {
    type: Number,
    default: -1 // -1 means unlimited
  },
  executionCount: {
    type: Number,
    default: 0
  },
  // Timing settings
  delay: {
    type: Number, // in minutes
    default: 0
  },
  timeWindow: {
    start: String, // HH:MM format
    end: String,   // HH:MM format
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  // Categories and tags
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastExecuted: Date,
  nextExecution: Date,
  // Statistics
  successCount: {
    type: Number,
    default: 0
  },
  failureCount: {
    type: Number,
    default: 0
  },
  lastError: String,
  // Advanced settings
  stopOnFirstMatch: {
    type: Boolean,
    default: false
  },
  requireAllConditions: {
    type: Boolean,
    default: true
  },
  // Notifications
  notifyOnSuccess: {
    type: Boolean,
    default: false
  },
  notifyOnFailure: {
    type: Boolean,
    default: true
  },
  notifyRecipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes for better performance
automationSchema.index({ 'trigger.type': 1, isActive: 1 });
automationSchema.index({ categories: 1 });
automationSchema.index({ tags: 1 });
automationSchema.index({ nextExecution: 1 });
automationSchema.index({ executionOrder: 1 });

// Virtual for success rate
automationSchema.virtual('successRate').get(function() {
  const total = this.successCount + this.failureCount;
  return total > 0 ? Math.round((this.successCount / total) * 100) : 0;
});

// Virtual for is due for execution
automationSchema.virtual('isDueForExecution').get(function() {
  if (!this.isActive) return false;
  if (this.maxExecutions > 0 && this.executionCount >= this.maxExecutions) return false;
  if (this.nextExecution && new Date() < this.nextExecution) return false;
  return true;
});

// Pre-save middleware to calculate next execution
automationSchema.pre('save', function(next) {
  if (this.isModified('trigger.schedule') && this.trigger.schedule) {
    // Calculate next execution based on cron expression
    // This is a simplified version - in production, use a proper cron library
    this.nextExecution = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours
  }
  next();
});

// Method to check if automation should execute
automationSchema.methods.shouldExecute = function(ticket, context = {}) {
  if (!this.isActive) return false;
  if (this.maxExecutions > 0 && this.executionCount >= this.maxExecutions) return false;
  
  // Check time window
  if (this.timeWindow.start && this.timeWindow.end) {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
    if (currentTime < this.timeWindow.start || currentTime > this.timeWindow.end) {
      return false;
    }
  }
  
  // Check trigger conditions
  if (!this.matchesTrigger(ticket, context)) return false;
  
  // Check additional conditions
  if (this.conditions.length > 0) {
    return this.matchesConditions(ticket);
  }
  
  return true;
};

// Method to check if ticket matches trigger
automationSchema.methods.matchesTrigger = function(ticket, context) {
  switch (this.trigger.type) {
    case 'ticket_created':
      return context.action === 'created';
    case 'ticket_updated':
      return context.action === 'updated';
    case 'comment_added':
      return context.action === 'comment_added';
    case 'status_changed':
      return context.action === 'status_changed';
    case 'priority_changed':
      return context.action === 'priority_changed';
    case 'assigned_changed':
      return context.action === 'assigned_changed';
    case 'sla_breached':
      return ticket.slaStatus === 'response_breached' || ticket.slaStatus === 'resolution_breached';
    case 'time_based':
      return this.isDueForExecution;
    default:
      return false;
  }
};

// Method to check if ticket matches conditions
automationSchema.methods.matchesConditions = function(ticket) {
  if (this.conditions.length === 0) return true;
  
  const matches = this.conditions.map(condition => {
    const fieldValue = this.getFieldValue(ticket, condition.field);
    return this.evaluateCondition(fieldValue, condition.operator, condition.value);
  });
  
  return this.requireAllConditions ? matches.every(match => match) : matches.some(match => match);
};

// Method to get field value from ticket
automationSchema.methods.getFieldValue = function(ticket, field) {
  const fieldMap = {
    'status': ticket.status,
    'priority': ticket.priority,
    'category': ticket.category?.name || ticket.category,
    'assignedTo': ticket.assignedTo?.name || ticket.assignedTo,
    'createdBy': ticket.createdBy?.name || ticket.createdBy,
    'tags': ticket.tags,
    'subject': ticket.subject,
    'description': ticket.description,
    'slaStatus': ticket.slaStatus,
    'totalTimeSpent': ticket.totalTimeSpent,
    'commentsCount': ticket.comments?.length || 0
  };
  
  return fieldMap[field] || ticket[field];
};

// Method to evaluate condition
automationSchema.methods.evaluateCondition = function(fieldValue, operator, conditionValue) {
  switch (operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    case 'is_empty':
      return !fieldValue || fieldValue === '';
    case 'is_not_empty':
      return fieldValue && fieldValue !== '';
    default:
      return false;
  }
};

// Method to execute automation
automationSchema.methods.execute = async function(ticket, context = {}) {
  try {
    if (!this.shouldExecute(ticket, context)) {
      return { success: false, reason: 'Conditions not met' };
    }
    
    // Execute actions
    for (const action of this.actions) {
      await this.executeAction(action, ticket, context);
    }
    
    // Update statistics
    this.executionCount += 1;
    this.successCount += 1;
    this.lastExecuted = new Date();
    
    // Calculate next execution for time-based automations
    if (this.trigger.type === 'time_based' && this.trigger.schedule) {
      this.nextExecution = new Date(Date.now() + 24 * 60 * 60 * 1000); // Simplified
    }
    
    await this.save();
    
    return { success: true };
  } catch (error) {
    this.failureCount += 1;
    this.lastError = error.message;
    await this.save();
    
    return { success: false, error: error.message };
  }
};

// Method to execute individual action
automationSchema.methods.executeAction = async function(action, ticket, context) {
  switch (action.type) {
    case 'assign_ticket':
      if (action.parameters.assignTo) {
        ticket.assignedTo = action.parameters.assignTo;
        await ticket.save();
      }
      break;
      
    case 'change_status':
      if (action.parameters.status) {
        ticket.status = action.parameters.status;
        await ticket.save();
      }
      break;
      
    case 'change_priority':
      if (action.parameters.priority) {
        ticket.priority = action.parameters.priority;
        await ticket.save();
      }
      break;
      
    case 'add_tag':
      if (action.parameters.tag && !ticket.tags.includes(action.parameters.tag)) {
        ticket.tags.push(action.parameters.tag);
        await ticket.save();
      }
      break;
      
    case 'remove_tag':
      if (action.parameters.tag) {
        ticket.tags = ticket.tags.filter(tag => tag !== action.parameters.tag);
        await ticket.save();
      }
      break;
      
    case 'escalate_ticket':
      ticket.escalated = true;
      ticket.escalatedAt = new Date();
      ticket.escalatedBy = context.userId;
      await ticket.save();
      break;
      
    case 'add_comment':
      if (action.parameters.comment) {
        ticket.comments.push({
          content: action.parameters.comment,
          user: context.userId || ticket.assignedTo,
          isInternal: true
        });
        await ticket.save();
      }
      break;
      
    case 'update_custom_field':
      if (action.parameters.customField) {
        const existingField = ticket.customFields.find(f => f.name === action.parameters.customField.name);
        if (existingField) {
          existingField.value = action.parameters.customField.value;
        } else {
          ticket.customFields.push(action.parameters.customField);
        }
        await ticket.save();
      }
      break;
  }
};

module.exports = mongoose.model('Automation', automationSchema); 