const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const TicketResolutionAgent = require('../utils/ticketAgent');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');

const agent = new TicketResolutionAgent();

// Get AI agent analysis for a ticket
router.post('/analyze/:ticketId', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('category', 'name')
      .populate('createdBy', 'name email');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get knowledge base articles for context
    const knowledgeBase = await getKnowledgeBaseArticles();

    // Analyze ticket with AI agent
    const analysis = await agent.analyzeTicket(ticket, knowledgeBase);

    res.json({
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status
      },
      analysis,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error analyzing ticket:', error);
    res.status(500).json({ message: 'Error analyzing ticket' });
  }
});

// Auto-resolve ticket with AI agent
router.post('/resolve/:ticketId', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user has permission to resolve
    const canResolve = req.user.role === 'admin' || 
                      req.user.role === 'agent' ||
                      (req.user.role === 'user' && ticket.createdBy.toString() === req.user.id);

    if (!canResolve) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get knowledge base articles
    const knowledgeBase = await getKnowledgeBaseArticles();

    // Generate AI response and attempt auto-resolution
    const response = await agent.generateResponse(ticket, knowledgeBase);

    res.json({
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        status: ticket.status,
        resolvedAt: ticket.resolvedAt,
        resolvedBy: ticket.resolvedBy
      },
      response,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error auto-resolving ticket:', error);
    res.status(500).json({ message: 'Error auto-resolving ticket' });
  }
});

// Batch analyze multiple tickets
router.post('/batch-analyze', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { ticketIds } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ message: 'Ticket IDs array is required' });
    }

    const tickets = await Ticket.find({ _id: { $in: ticketIds } })
      .populate('category', 'name')
      .populate('createdBy', 'name email');

    if (tickets.length === 0) {
      return res.status(404).json({ message: 'No tickets found' });
    }

    // Get knowledge base articles
    const knowledgeBase = await getKnowledgeBaseArticles();

    // Batch analyze tickets
    const results = await agent.batchAnalyzeTickets(tickets, knowledgeBase);

    res.json({
      results,
      totalAnalyzed: results.length,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error batch analyzing tickets:', error);
    res.status(500).json({ message: 'Error batch analyzing tickets' });
  }
});

// Get AI agent suggestions for ticket response
router.post('/suggest-response/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { userMessage } = req.body;
    const ticket = await Ticket.findById(req.params.ticketId)
      .populate('category', 'name')
      .populate('createdBy', 'name email');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get knowledge base articles
    const knowledgeBase = await getKnowledgeBaseArticles();

    // Generate AI response
    const response = await agent.generateResponse(ticket, knowledgeBase);

    // Add user message to context for better suggestions
    const enhancedResponse = {
      ...response,
      suggestedResponse: generateSuggestedResponse(userMessage, response.analysis),
      knowledgeBaseArticles: response.suggestedArticles
    };

    res.json(enhancedResponse);

  } catch (error) {
    console.error('Error generating response suggestions:', error);
    res.status(500).json({ message: 'Error generating response suggestions' });
  }
});

// Get AI agent statistics
router.get('/stats', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const stats = await agent.getAgentStats();

    // Get additional analytics
    const totalTickets = await Ticket.countDocuments();
    const aiResolvedTickets = await Ticket.countDocuments({ resolvedBy: 'AI Agent' });
    const avgResolutionTime = await Ticket.aggregate([
      { $match: { resolvedBy: 'AI Agent' } },
      { $group: { _id: null, avgTime: { $avg: '$resolutionTime' } } }
    ]);

    res.json({
      agentStats: stats,
      analytics: {
        totalTickets,
        aiResolvedTickets,
        aiResolutionRate: totalTickets > 0 ? (aiResolvedTickets / totalTickets) * 100 : 0,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0
      },
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error getting AI agent stats:', error);
    res.status(500).json({ message: 'Error getting AI agent stats' });
  }
});

// Get AI agent performance by category
router.get('/stats/by-category', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const stats = await Ticket.aggregate([
      { $match: { resolvedBy: 'AI Agent' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgResolutionTime: { $avg: '$resolutionTime' },
          avgConfidence: { $avg: '$comments.confidence' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      }
    ]);

    res.json({
      categoryStats: stats,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error getting category stats:', error);
    res.status(500).json({ message: 'Error getting category stats' });
  }
});

// Get AI agent performance by time period
router.get('/stats/by-period', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '24h':
        dateFilter = { resolvedAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { resolvedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { resolvedAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      default:
        dateFilter = { resolvedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    }

    const stats = await Ticket.aggregate([
      { $match: { ...dateFilter, resolvedBy: 'AI Agent' } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' }
          },
          count: { $sum: 1 },
          avgResolutionTime: { $avg: '$resolutionTime' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      periodStats: stats,
      period,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error getting period stats:', error);
    res.status(500).json({ message: 'Error getting period stats' });
  }
});

// Helper function to get knowledge base articles
async function getKnowledgeBaseArticles() {
  try {
    // In a real implementation, this would fetch from the knowledge base API
    // For now, return a basic structure
    return [
      {
        _id: '1',
        title: 'Login Issue Resolution',
        content: 'Steps to resolve login issues...',
        category: 'technical',
        tags: ['login', 'authentication']
      },
      {
        _id: '2',
        title: 'Password Reset Guide',
        content: 'How to reset your password...',
        category: 'technical',
        tags: ['password', 'reset']
      },
      {
        _id: '3',
        title: 'File Upload Troubleshooting',
        content: 'Common file upload issues and solutions...',
        category: 'technical',
        tags: ['upload', 'file']
      }
    ];
  } catch (error) {
    console.error('Error fetching knowledge base articles:', error);
    return [];
  }
}

// Helper function to generate suggested response
function generateSuggestedResponse(userMessage, analysis) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('thank') || message.includes('thanks')) {
    return 'You\'re welcome! Is there anything else I can help you with?';
  }
  
  if (message.includes('not working') || message.includes('still have problem')) {
    return 'I understand the issue is still persisting. Let me escalate this to a human agent who can provide more specialized assistance.';
  }
  
  if (message.includes('work') || message.includes('fixed')) {
    return 'Great to hear that the solution worked! Is there anything else you need help with?';
  }
  
  return analysis.response.message;
}

module.exports = router; 