const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Automation = require('../models/Automation');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Get all automations
router.get('/', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) query.isActive = status === 'active';
    if (type) query['trigger.type'] = type;
    
    const automations = await Automation.find(query)
      .populate('createdBy', 'name email')
      .populate('categories', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Automation.countDocuments(query);
    
    res.json({
      automations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single automation
router.get('/:id', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('categories', 'name')
      .populate('notifyRecipients', 'name email');
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    res.json({ automation });
  } catch (error) {
    console.error('Error fetching automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create automation
router.post('/', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const {
      name,
      description,
      trigger,
      conditions,
      actions,
      categories,
      tags,
      schedule,
      settings
    } = req.body;
    
    const automation = new Automation({
      name,
      description,
      trigger,
      conditions,
      actions,
      categories,
      tags,
      schedule,
      settings,
      createdBy: req.user.id
    });
    
    await automation.save();
    
    res.status(201).json({ automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update automation
router.put('/:id', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const automation = await Automation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    res.json({ automation });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete automation
router.delete('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const automation = await Automation.findByIdAndDelete(req.params.id);
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    res.json({ message: 'Automation deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Execute automation manually
router.post('/:id/execute', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    const { ticketId } = req.body;
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    const result = await automation.execute(ticket, {
      action: 'manual_execution',
      userId: req.user.id
    });
    
    res.json({ result });
  } catch (error) {
    console.error('Error executing automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get automation statistics
router.get('/:id/stats', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    const stats = {
      totalExecutions: automation.executionCount,
      successRate: automation.successRate,
      lastExecuted: automation.lastExecuted,
      nextExecution: automation.nextExecution,
      successCount: automation.successCount,
      failureCount: automation.failureCount,
      lastError: automation.lastError
    };
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching automation stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test automation conditions
router.post('/:id/test', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    const { ticketId } = req.body;
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    const shouldExecute = automation.shouldExecute(ticket, {
      action: 'test'
    });
    
    const matchesTrigger = automation.matchesTrigger(ticket, {
      action: 'test'
    });
    
    const matchesConditions = automation.matchesConditions(ticket);
    
    res.json({
      shouldExecute,
      matchesTrigger,
      matchesConditions,
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category
      }
    });
  } catch (error) {
    console.error('Error testing automation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get automation templates
router.get('/templates', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const templates = [
      {
        name: 'Auto-assign by category',
        description: 'Automatically assign tickets based on category',
        trigger: {
          type: 'ticket_created'
        },
        conditions: [
          {
            field: 'category',
            operator: 'equals',
            value: 'technical'
          }
        ],
        actions: [
          {
            type: 'assign_ticket',
            parameters: {
              assignTo: null // Will be set by user
            }
          }
        ]
      },
      {
        name: 'Escalate overdue tickets',
        description: 'Escalate tickets that are overdue',
        trigger: {
          type: 'time_based',
          schedule: '0 */4 * * *' // Every 4 hours
        },
        conditions: [
          {
            field: 'status',
            operator: 'equals',
            value: 'open'
          },
          {
            field: 'createdAt',
            operator: 'less_than',
            value: '24h'
          }
        ],
        actions: [
          {
            type: 'escalate_ticket',
            parameters: {}
          },
          {
            type: 'add_comment',
            parameters: {
              comment: 'Ticket escalated due to overdue status'
            }
          }
        ]
      },
      {
        name: 'Auto-close resolved tickets',
        description: 'Automatically close tickets after 7 days of being resolved',
        trigger: {
          type: 'time_based',
          schedule: '0 9 * * *' // Daily at 9 AM
        },
        conditions: [
          {
            field: 'status',
            operator: 'equals',
            value: 'resolved'
          },
          {
            field: 'resolvedAt',
            operator: 'less_than',
            value: '7d'
          }
        ],
        actions: [
          {
            type: 'change_status',
            parameters: {
              status: 'closed'
            }
          }
        ]
      },
      {
        name: 'High priority notification',
        description: 'Send notification for high priority tickets',
        trigger: {
          type: 'ticket_created'
        },
        conditions: [
          {
            field: 'priority',
            operator: 'in',
            value: ['high', 'urgent', 'critical']
          }
        ],
        actions: [
          {
            type: 'send_notification',
            parameters: {
              notificationMessage: 'High priority ticket created'
            }
          }
        ]
      }
    ];
    
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching automation templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk operations on automations
router.post('/bulk', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { operation, automationIds } = req.body;
    
    if (!operation || !automationIds || !Array.isArray(automationIds)) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }
    
    let updateData = {};
    
    switch (operation) {
      case 'activate':
        updateData.isActive = true;
        break;
      case 'deactivate':
        updateData.isActive = false;
        break;
      case 'delete':
        await Automation.deleteMany({ _id: { $in: automationIds } });
        return res.json({ message: `${automationIds.length} automations deleted successfully` });
      default:
        return res.status(400).json({ message: 'Invalid operation' });
    }
    
    const result = await Automation.updateMany(
      { _id: { $in: automationIds } },
      updateData
    );
    
    res.json({
      message: `${result.modifiedCount} automations updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 