const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['user', 'bot', 'agent'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageType: {
    type: String,
    enum: ['text', 'quick_reply', 'image', 'file', 'button', 'card'],
    default: 'text'
  },
  metadata: {
    intent: String,
    confidence: Number,
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }],
    suggestedActions: [{
      type: String,
      label: String,
      value: String
    }]
  }
});

const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  guestId: {
    type: String,
    trim: true
  },
  // Conversation state
  status: {
    type: String,
    enum: ['active', 'waiting_for_agent', 'resolved', 'closed'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  // AI and automation
  aiEnabled: {
    type: Boolean,
    default: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  intent: {
    type: String,
    trim: true
  },
  entities: [{
    type: String,
    value: String,
    confidence: Number
  }],
  // Agent assignment
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalationReason: String,
  // Messages
  messages: [messageSchema],
  // Context and history
  context: {
    userInfo: {
      name: String,
      email: String,
      phone: String,
      department: String
    },
    ticketInfo: {
      ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket'
      },
      subject: String,
      status: String
    },
    preferences: {
      language: {
        type: String,
        default: 'en'
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  // Analytics
  analytics: {
    responseTime: {
      type: Number, // in seconds
      default: 0
    },
    satisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      feedback: String,
      submittedAt: Date
    },
    resolutionTime: {
      type: Number, // in minutes
      default: 0
    },
    messageCount: {
      user: {
        type: Number,
        default: 0
      },
      bot: {
        type: Number,
        default: 0
      },
      agent: {
        type: Number,
        default: 0
      }
    }
  },
  // Settings
  settings: {
    autoRespond: {
      type: Boolean,
      default: true
    },
    autoEscalate: {
      type: Boolean,
      default: true
    },
    escalationThreshold: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.3
    },
    maxMessages: {
      type: Number,
      default: 50
    }
  },
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  closedAt: Date
}, {
  timestamps: true
});

// Indexes for better performance
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ userId: 1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ assignedAgent: 1 });
conversationSchema.index({ 'context.ticketInfo.ticketId': 1 });
conversationSchema.index({ lastActivityAt: -1 });
conversationSchema.index({ startedAt: -1 });

// Virtual for conversation duration
conversationSchema.virtual('duration').get(function() {
  const endTime = this.resolvedAt || this.closedAt || new Date();
  return Math.round((endTime - this.startedAt) / (1000 * 60)); // in minutes
});

// Virtual for is active
conversationSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'waiting_for_agent';
});

// Virtual for total messages
conversationSchema.virtual('totalMessages').get(function() {
  return this.messages.length;
});

// Pre-save middleware to update last activity
conversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.lastActivityAt = new Date();
    
    // Update message counts
    this.analytics.messageCount.user = this.messages.filter(m => m.sender === 'user').length;
    this.analytics.messageCount.bot = this.messages.filter(m => m.sender === 'bot').length;
    this.analytics.messageCount.agent = this.messages.filter(m => m.sender === 'agent').length;
  }
  
  // Update resolution time
  if (this.isModified('status') && (this.status === 'resolved' || this.status === 'closed')) {
    this.resolvedAt = new Date();
    this.analytics.resolutionTime = Math.round((this.resolvedAt - this.startedAt) / (1000 * 60));
  }
  
  next();
});

// Method to add message
conversationSchema.methods.addMessage = function(content, sender, metadata = {}) {
  const message = {
    content,
    sender,
    timestamp: new Date(),
    metadata
  };
  
  this.messages.push(message);
  return this.save();
};

// Method to get bot response
conversationSchema.methods.getBotResponse = async function(userMessage) {
  // Simple AI response logic - in production, integrate with OpenAI, Dialogflow, etc.
  const response = await this.generateAIResponse(userMessage);
  
  await this.addMessage(response.content, 'bot', {
    intent: response.intent,
    confidence: response.confidence,
    entities: response.entities,
    suggestedActions: response.suggestedActions
  });
  
  return response;
};

// Method to generate AI response
conversationSchema.methods.generateAIResponse = async function(userMessage) {
  const message = userMessage.toLowerCase();
  
  // Simple keyword-based responses
  const responses = {
    greeting: {
      keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
      responses: [
        'Hello! How can I help you today?',
        'Hi there! Welcome to QuickDesk support. How may I assist you?',
        'Hello! I\'m here to help. What can I do for you?'
      ]
    },
    ticket: {
      keywords: ['ticket', 'issue', 'problem', 'help', 'support'],
      responses: [
        'I can help you create a support ticket. What\'s the issue you\'re experiencing?',
        'I\'d be happy to help you with that. Could you describe the problem in detail?',
        'Let me help you create a ticket. What seems to be the problem?'
      ]
    },
    status: {
      keywords: ['status', 'update', 'progress', 'check'],
      responses: [
        'I can help you check the status of your tickets. Do you have a ticket number?',
        'To check your ticket status, please provide your ticket number.',
        'I\'ll help you check the status. What\'s your ticket number?'
      ]
    },
    password: {
      keywords: ['password', 'reset', 'forgot', 'login'],
      responses: [
        'I can help you with password reset. Please provide your email address.',
        'For password reset, I\'ll need your email address to send you a reset link.',
        'Let me help you reset your password. What\'s your email address?'
      ]
    },
    goodbye: {
      keywords: ['bye', 'goodbye', 'thanks', 'thank you', 'end'],
      responses: [
        'You\'re welcome! Feel free to reach out if you need anything else.',
        'Thank you for contacting us. Have a great day!',
        'You\'re welcome! Don\'t hesitate to contact us again if needed.'
      ]
    }
  };
  
  // Find matching intent
  let matchedIntent = 'general';
  let confidence = 0.5;
  
  for (const [intent, data] of Object.entries(responses)) {
    for (const keyword of data.keywords) {
      if (message.includes(keyword)) {
        matchedIntent = intent;
        confidence = 0.8;
        break;
      }
    }
    if (matchedIntent !== 'general') break;
  }
  
  // Get response
  const intentResponses = responses[matchedIntent]?.responses || [
    'I understand you need help. Could you please provide more details?',
    'I\'m here to help. What specific issue are you facing?',
    'Let me assist you with that. Can you give me more information?'
  ];
  
  const response = intentResponses[Math.floor(Math.random() * intentResponses.length)];
  
  // Generate suggested actions
  const suggestedActions = this.generateSuggestedActions(matchedIntent);
  
  return {
    content: response,
    intent: matchedIntent,
    confidence,
    entities: [],
    suggestedActions
  };
};

// Method to generate suggested actions
conversationSchema.methods.generateSuggestedActions = function(intent) {
  const actions = {
    greeting: [
      { type: 'button', label: 'Create Ticket', value: 'create_ticket' },
      { type: 'button', label: 'Check Status', value: 'check_status' },
      { type: 'button', label: 'Knowledge Base', value: 'knowledge_base' }
    ],
    ticket: [
      { type: 'button', label: 'Technical Issue', value: 'category_technical' },
      { type: 'button', label: 'Billing Question', value: 'category_billing' },
      { type: 'button', label: 'General Inquiry', value: 'category_general' }
    ],
    status: [
      { type: 'button', label: 'Provide Ticket Number', value: 'provide_ticket' },
      { type: 'button', label: 'View All Tickets', value: 'view_tickets' }
    ],
    password: [
      { type: 'button', label: 'Reset Password', value: 'reset_password' },
      { type: 'button', label: 'Contact Support', value: 'contact_support' }
    ],
    general: [
      { type: 'button', label: 'Create Ticket', value: 'create_ticket' },
      { type: 'button', label: 'Knowledge Base', value: 'knowledge_base' },
      { type: 'button', label: 'Contact Agent', value: 'contact_agent' }
    ]
  };
  
  return actions[intent] || actions.general;
};

// Method to escalate conversation
conversationSchema.methods.escalate = async function(reason = 'Low confidence response') {
  this.status = 'waiting_for_agent';
  this.escalationReason = reason;
  this.confidence = 0;
  
  await this.addMessage(
    'I\'m connecting you to a human agent who will be able to help you better.',
    'bot'
  );
  
  return this.save();
};

// Method to assign agent
conversationSchema.methods.assignAgent = async function(agentId) {
  this.assignedAgent = agentId;
  this.status = 'waiting_for_agent';
  
  await this.addMessage(
    'You have been connected to a support agent. They will assist you shortly.',
    'bot'
  );
  
  return this.save();
};

// Method to resolve conversation
conversationSchema.methods.resolve = async function() {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  
  await this.addMessage(
    'Thank you for contacting us. This conversation has been resolved. Have a great day!',
    'bot'
  );
  
  return this.save();
};

// Method to create ticket from conversation
conversationSchema.methods.createTicket = async function(ticketData) {
  const Ticket = require('./Ticket');
  
  const ticket = new Ticket({
    subject: ticketData.subject || 'Support Request from Chat',
    description: ticketData.description || this.messages.map(m => `${m.sender}: ${m.content}`).join('\n'),
    category: ticketData.category,
    priority: ticketData.priority || this.priority,
    createdBy: this.userId,
    source: 'chat',
    customFields: [
      {
        name: 'Conversation ID',
        value: this.sessionId,
        type: 'text'
      }
    ]
  });
  
  await ticket.save();
  
  // Update conversation with ticket info
  this.context.ticketInfo.ticketId = ticket._id;
  this.context.ticketInfo.subject = ticket.subject;
  this.context.ticketInfo.status = ticket.status;
  
  await this.addMessage(
    `I've created a ticket for you (Ticket #${ticket._id.toString().slice(-6)}). An agent will review it shortly.`,
    'bot'
  );
  
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema); 