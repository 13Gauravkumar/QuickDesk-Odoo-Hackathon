const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Conversation = require('../models/Chatbot');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Get all conversations (for agents/admins)
router.get('/', authenticateToken, authorize(['agent', 'admin', 'supervisor']), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, assignedAgent } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) query.status = status;
    if (assignedAgent) query.assignedAgent = assignedAgent;
    
    const conversations = await Conversation.find(query)
      .populate('userId', 'name email')
      .populate('assignedAgent', 'name email')
      .populate('category', 'name')
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Conversation.countDocuments(query);
    
    res.json({
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's conversations
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.user.id })
      .populate('assignedAgent', 'name email')
      .populate('category', 'name')
      .sort({ lastActivityAt: -1 });
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single conversation
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('assignedAgent', 'name email')
      .populate('category', 'name')
      .populate('context.ticketInfo.ticketId');
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has access to this conversation
    if (req.user.role === 'user' && conversation.userId?._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start new conversation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { guestId, category, priority, initialMessage } = req.body;
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conversation = new Conversation({
      sessionId,
      userId: req.user.role === 'user' ? req.user.id : null,
      guestId: req.user.role === 'user' ? null : guestId,
      category,
      priority,
      context: {
        userInfo: {
          name: req.user.name,
          email: req.user.email
        }
      }
    });
    
    await conversation.save();
    
    // Add initial message if provided
    if (initialMessage) {
      await conversation.addMessage(initialMessage, 'user');
      
      // Get bot response
      const botResponse = await conversation.getBotResponse(initialMessage);
    }
    
    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message to conversation
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has access to this conversation
    if (req.user.role === 'user' && conversation.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Add user message
    await conversation.addMessage(content, 'user', { messageType });
    
    // Get bot response if AI is enabled and conversation is active
    let botResponse = null;
    if (conversation.aiEnabled && conversation.status === 'active') {
      botResponse = await conversation.getBotResponse(content);
      
      // Check if confidence is low and auto-escalate is enabled
      if (conversation.settings.autoEscalate && botResponse.confidence < conversation.settings.escalationThreshold) {
        await conversation.escalate('Low confidence response');
      }
    }
    
    res.json({ 
      conversation,
      botResponse: botResponse ? {
        content: botResponse.content,
        confidence: botResponse.confidence,
        suggestedActions: botResponse.suggestedActions
      } : null
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Agent joins conversation
router.post('/:id/join', authenticateToken, authorize(['agent', 'admin', 'supervisor']), async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (conversation.assignedAgent) {
      return res.status(400).json({ message: 'Conversation already assigned to an agent' });
    }
    
    conversation.assignedAgent = req.user.id;
    conversation.status = 'waiting_for_agent';
    
    await conversation.addMessage(
      `${req.user.name} has joined the conversation and will assist you shortly.`,
      'agent'
    );
    
    await conversation.save();
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error joining conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Agent leaves conversation
router.post('/:id/leave', authenticateToken, authorize(['agent', 'admin', 'supervisor']), async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (conversation.assignedAgent?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not assigned to this conversation' });
    }
    
    conversation.assignedAgent = null;
    conversation.status = 'active';
    
    await conversation.addMessage(
      `${req.user.name} has left the conversation. You will be connected to another agent shortly.`,
      'agent'
    );
    
    await conversation.save();
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error leaving conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Resolve conversation
router.post('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has permission to resolve
    const canResolve = req.user.role === 'admin' || 
                      req.user.role === 'supervisor' ||
                      (req.user.role === 'agent' && conversation.assignedAgent?.toString() === req.user.id) ||
                      (req.user.role === 'user' && conversation.userId?.toString() === req.user.id);
    
    if (!canResolve) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await conversation.resolve();
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error resolving conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create ticket from conversation
router.post('/:id/create-ticket', authenticateToken, async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has access to this conversation
    if (req.user.role === 'user' && conversation.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const ticketData = {
      subject: subject || 'Support Request from Chat',
      description: description || conversation.messages.map(m => `${m.sender}: ${m.content}`).join('\n'),
      category,
      priority: priority || conversation.priority,
      source: 'chat'
    };
    
    await conversation.createTicket(ticketData);
    
    res.json({ 
      conversation,
      message: 'Ticket created successfully from conversation'
    });
  } catch (error) {
    console.error('Error creating ticket from conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update conversation settings
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has access to this conversation
    if (req.user.role === 'user' && conversation.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    conversation.settings = { ...conversation.settings, ...settings };
    await conversation.save();
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error updating conversation settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit satisfaction rating
router.post('/:id/satisfaction', authenticateToken, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Check if user has access to this conversation
    if (req.user.role === 'user' && conversation.userId?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    conversation.analytics.satisfaction = {
      rating: parseInt(rating),
      feedback,
      submittedAt: new Date()
    };
    
    await conversation.save();
    
    res.json({ 
      conversation,
      message: 'Satisfaction rating submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting satisfaction rating:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get conversation analytics
router.get('/:id/analytics', authenticateToken, authorize(['agent', 'admin', 'supervisor']), async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const analytics = {
      duration: conversation.duration,
      totalMessages: conversation.totalMessages,
      messageCount: conversation.analytics.messageCount,
      responseTime: conversation.analytics.responseTime,
      resolutionTime: conversation.analytics.resolutionTime,
      satisfaction: conversation.analytics.satisfaction,
      confidence: conversation.confidence,
      intent: conversation.intent,
      entities: conversation.entities
    };
    
    res.json({ analytics });
  } catch (error) {
    console.error('Error fetching conversation analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chatbot statistics
router.get('/stats/overview', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const stats = await Conversation.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          activeConversations: {
            $sum: { $cond: [{ $in: ['$status', ['active', 'waiting_for_agent']] }, 1, 0] }
          },
          resolvedConversations: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgDuration: { $avg: '$analytics.resolutionTime' },
          avgSatisfaction: { $avg: '$analytics.satisfaction.rating' },
          totalMessages: { $sum: { $size: '$messages' } },
          avgConfidence: { $avg: '$confidence' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalConversations: 0,
      activeConversations: 0,
      resolvedConversations: 0,
      avgDuration: 0,
      avgSatisfaction: 0,
      totalMessages: 0,
      avgConfidence: 0
    };
    
    res.json({ stats: result });
  } catch (error) {
    console.error('Error fetching chatbot statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available agents for assignment
router.get('/agents/available', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const agents = await User.find({ 
      role: { $in: ['agent', 'supervisor'] },
      isActive: true
    }).select('name email role availability skills');
    
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching available agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign conversation to agent
router.post('/:id/assign', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { agentId } = req.body;
    
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const agent = await User.findById(agentId);
    
    if (!agent || !['agent', 'supervisor'].includes(agent.role)) {
      return res.status(400).json({ message: 'Invalid agent' });
    }
    
    await conversation.assignAgent(agentId);
    
    res.json({ conversation });
  } catch (error) {
    console.error('Error assigning conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 