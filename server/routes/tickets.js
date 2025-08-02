const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const User = require('../models/User');
const { authenticateToken, authorize, canAccessTicket } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../utils/email');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed'));
    }
  }
});

// @route   GET /api/tickets
// @desc    Get all tickets with filtering and pagination
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const skip = page * limit;
    
    const { 
      search, 
      status, 
      category, 
      priority, 
      sort = '-createdAt',
      overdue,
      highPriority,
      unassigned,
      myTickets,
      recentActivity
    } = req.query;
    
    // Build query
    let query = {};
    
    // If user is not admin, only show their own tickets
    if (req.user && req.user.role !== 'admin') {
      query.createdBy = req.user.id;
    }
    
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (priority) {
      query.priority = priority;
    }

    // Smart filters
    if (overdue === 'true') {
      query.$and = [
        { status: 'open' },
        { createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ];
    }

    if (highPriority === 'true') {
      query.priority = { $in: ['urgent', 'high'] };
    }

    if (unassigned === 'true') {
      query.assignedTo = { $exists: false };
    }

    if (myTickets === 'true') {
      query.assignedTo = req.user.id;
    }

    if (recentActivity === 'true') {
      query.updatedAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }
    
    const tickets = await Ticket.find(query)
      .populate('category', 'name color')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Ticket.countDocuments(query);
    
    res.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/ai-suggestions
// @desc    Get AI-powered search suggestions
// @access  Private
router.get('/ai-suggestions', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 3) {
      return res.json([]);
    }

    // Simple AI-like suggestions based on common patterns
    const suggestions = [];
    const queryLower = query.toLowerCase();

    // Common ticket patterns
    const patterns = [
      { pattern: 'login', suggestion: 'Search for login issues' },
      { pattern: 'password', suggestion: 'Search for password reset issues' },
      { pattern: 'upload', suggestion: 'Search for file upload problems' },
      { pattern: 'download', suggestion: 'Search for download issues' },
      { pattern: 'error', suggestion: 'Search for error messages' },
      { pattern: 'slow', suggestion: 'Search for performance issues' },
      { pattern: 'billing', suggestion: 'Search for billing questions' },
      { pattern: 'payment', suggestion: 'Search for payment issues' },
      { pattern: 'account', suggestion: 'Search for account management' },
      { pattern: 'security', suggestion: 'Search for security concerns' }
    ];

    patterns.forEach(({ pattern, suggestion }) => {
      if (queryLower.includes(pattern) || pattern.includes(queryLower)) {
        suggestions.push({
          suggestion,
          query: pattern,
          type: 'pattern'
        });
      }
    });

    // Status-based suggestions
    const statusSuggestions = [
      { status: 'open', suggestion: 'Show open tickets' },
      { status: 'in-progress', suggestion: 'Show tickets in progress' },
      { status: 'resolved', suggestion: 'Show resolved tickets' }
    ];

    statusSuggestions.forEach(({ status, suggestion }) => {
      if (queryLower.includes(status)) {
        suggestions.push({
          suggestion,
          query: `status:${status}`,
          type: 'status'
        });
      }
    });

    // Priority-based suggestions
    const prioritySuggestions = [
      { priority: 'urgent', suggestion: 'Show urgent tickets' },
      { priority: 'high', suggestion: 'Show high priority tickets' },
      { priority: 'medium', suggestion: 'Show medium priority tickets' },
      { priority: 'low', suggestion: 'Show low priority tickets' }
    ];

    prioritySuggestions.forEach(({ priority, suggestion }) => {
      if (queryLower.includes(priority)) {
        suggestions.push({
          suggestion,
          query: `priority:${priority}`,
          type: 'priority'
        });
      }
    });

    res.json(suggestions.slice(0, 5));
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    res.status(500).json({ message: 'Error generating suggestions' });
  }
});

// @route   POST /api/tickets/bulk
// @desc    Perform bulk operations on tickets
// @access  Private (Admin/Agent)
router.post('/bulk', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { operation, ticketIds, data } = req.body;

    if (!operation || !ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }

    let updateData = {};
    let emailTemplate = null;

    switch (operation) {
      case 'status':
        updateData.status = data.status;
        updateData.updatedAt = new Date();
        if (data.status === 'resolved') {
          updateData.resolvedAt = new Date();
        }
        emailTemplate = 'ticket_status_update';
        break;

      case 'assign':
        updateData.assignedTo = data.assignee;
        updateData.updatedAt = new Date();
        emailTemplate = 'ticket_assigned';
        break;

      case 'priority':
        updateData.priority = data.priority;
        updateData.updatedAt = new Date();
        emailTemplate = 'ticket_priority_update';
        break;

      case 'category':
        updateData.category = data.category;
        updateData.updatedAt = new Date();
        break;

      case 'delete':
        // Delete tickets
        await Ticket.deleteMany({ _id: { $in: ticketIds } });
        return res.json({ message: `${ticketIds.length} tickets deleted successfully` });

      default:
        return res.status(400).json({ message: 'Invalid operation' });
    }

    // Update tickets
    const result = await Ticket.updateMany(
      { _id: { $in: ticketIds } },
      updateData
    );

    // Send notifications if email template is specified
    if (emailTemplate) {
      const tickets = await Ticket.find({ _id: { $in: ticketIds } })
        .populate('createdBy', 'email name')
        .populate('assignedTo', 'email name');

      for (const ticket of tickets) {
        if (ticket.createdBy?.email) {
          await sendEmail(
            ticket.createdBy.email,
            emailTemplates[emailTemplate].subject,
            emailTemplates[emailTemplate].body(ticket, req.user)
          );
        }
      }
    }

    // Emit real-time updates
    const emitToAll = req.app.get('emitToAll');
    const emitToUser = req.app.get('emitToUser');
    
    // Emit bulk operation event
    emitToAll('ticket:bulk_updated', { 
      operation, 
      ticketIds, 
      modifiedCount: result.modifiedCount 
    });
    
    // Emit dashboard stats update
    emitToAll('dashboard:stats:updated', { type: 'bulk_operation', operation });
    
    // Emit notifications to affected users
    if (operation === 'assign' && data.assignee) {
      emitToUser(data.assignee, 'notification:new', {
        type: 'assignment',
        title: 'Tickets Assigned',
        message: `You have been assigned to ${result.modifiedCount} tickets`,
        data: { ticketIds, count: result.modifiedCount }
      });
    }

    res.json({ 
      message: `${result.modifiedCount} tickets updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ message: 'Error performing bulk operation' });
  }
});

// @route   GET /api/tickets/workflow
// @desc    Get workflow automation rules and suggestions
// @access  Private (Admin/Agent)
router.get('/workflow', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    // Get workflow statistics and suggestions
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          overdueTickets: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'open'] },
                    { $lt: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] }
                  ]
                },
                1,
                0
              ]
            }
          },
          unassignedTickets: {
            $sum: { $cond: [{ $eq: ['$assignedTo', null] }, 1, 0] }
          }
        }
      }
    ]);

    // Get agent workload
    const agentWorkload = await Ticket.aggregate([
      {
        $match: { assignedTo: { $exists: true } }
      },
      {
        $group: {
          _id: '$assignedTo',
          ticketCount: { $sum: 1 },
          openCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      }
    ]);

    // Generate workflow suggestions
    const suggestions = [];

    if (stats[0]?.overdueTickets > 0) {
      suggestions.push({
        type: 'warning',
        message: `${stats[0].overdueTickets} tickets are overdue`,
        action: 'review_overdue_tickets'
      });
    }

    if (stats[0]?.unassignedTickets > 0) {
      suggestions.push({
        type: 'info',
        message: `${stats[0].unassignedTickets} tickets need assignment`,
        action: 'assign_unassigned_tickets'
      });
    }

    // Find agents with high workload
    const highWorkloadAgents = agentWorkload.filter(agent => agent.openCount > 5);
    if (highWorkloadAgents.length > 0) {
      suggestions.push({
        type: 'warning',
        message: `${highWorkloadAgents.length} agents have high workload`,
        action: 'redistribute_workload'
      });
    }

    res.json({
      stats: stats[0] || {},
      agentWorkload,
      suggestions
    });
  } catch (error) {
    console.error('Error fetching workflow data:', error);
    res.status(500).json({ message: 'Error fetching workflow data' });
  }
});

// @route   POST /api/tickets/auto-assign
// @desc    Automatically assign tickets based on workload
// @access  Private (Admin/Agent)
router.post('/auto-assign', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { ticketIds } = req.body;

    if (!ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ message: 'Invalid ticket IDs' });
    }

    // Get available agents
    const agents = await User.find({ role: { $in: ['admin', 'agent'] } });
    
    if (agents.length === 0) {
      return res.status(400).json({ message: 'No agents available for assignment' });
    }

    // Get current workload for each agent
    const agentWorkload = await Ticket.aggregate([
      {
        $match: { 
          assignedTo: { $exists: true },
          status: { $in: ['open', 'in-progress'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          openTickets: { $sum: 1 }
        }
      }
    ]);

    // Create workload map
    const workloadMap = new Map();
    agents.forEach(agent => {
      const workload = agentWorkload.find(w => w._id.toString() === agent._id.toString());
      workloadMap.set(agent._id.toString(), workload ? workload.openTickets : 0);
    });

    // Assign tickets to agents with least workload
    const assignments = [];
    for (const ticketId of ticketIds) {
      const leastBusyAgent = agents.reduce((min, agent) => {
        const minWorkload = workloadMap.get(min._id.toString()) || 0;
        const agentWorkload = workloadMap.get(agent._id.toString()) || 0;
        return agentWorkload < minWorkload ? agent : min;
      });

      // Update ticket assignment
      await Ticket.findByIdAndUpdate(ticketId, {
        assignedTo: leastBusyAgent._id,
        updatedAt: new Date()
      });

      // Update workload map
      const currentWorkload = workloadMap.get(leastBusyAgent._id.toString()) || 0;
      workloadMap.set(leastBusyAgent._id.toString(), currentWorkload + 1);

      assignments.push({
        ticketId,
        agentId: leastBusyAgent._id,
        agentName: leastBusyAgent.name
      });
    }

    res.json({
      message: `${assignments.length} tickets assigned successfully`,
      assignments
    });
  } catch (error) {
    console.error('Error auto-assigning tickets:', error);
    res.status(500).json({ message: 'Error auto-assigning tickets' });
  }
});

// Create new ticket
router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;
    
    if (!subject || !description || !category || !priority) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path
        });
      }
    }
    
    const ticket = new Ticket({
      subject,
      description,
      category,
      priority,
      createdBy: req.user.id,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await ticket.save();
    
    // Populate references
    await ticket.populate([
      { path: 'category', select: 'name color' },
      { path: 'createdBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email' }
    ]);
    
    // Send email notification to admins
    try {
      const admins = await User.find({ role: 'admin', isActive: true });
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: 'New Ticket Created',
          template: 'newTicket',
          data: {
            userName: req.user.name,
            ticketSubject: subject,
            ticketId: ticket._id
          }
        });
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }
    
    // Emit real-time updates
    const io = req.app.get('io');
    const emitToAll = req.app.get('emitToAll');
    const emitToUser = req.app.get('emitToUser');
    
    // Emit to all users
    emitToAll('ticket:created', { ticket });
    
    // Emit dashboard stats update
    emitToAll('dashboard:stats:updated', { type: 'ticket_created' });
    
    // Emit notification to admins
    const admins = await User.find({ role: 'admin', isActive: true });
    admins.forEach(admin => {
      emitToUser(admin._id.toString(), 'notification:new', {
        type: 'ticket',
        title: 'New Ticket Created',
        message: `New ticket "${subject}" has been created`,
        data: { ticketId: ticket._id, subject }
      });
    });
    
    res.status(201).json({ ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    let matchQuery = {};
    
    // If user is not admin, only show their own tickets
    if (user && user.role !== 'admin') {
      matchQuery.createdBy = userId;
    }

    const stats = await Ticket.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          inProgressTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          closedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get single ticket
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('category', 'name color')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'name email'
        }
      });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if user can access this ticket
    if (req.user && req.user.role === 'user' && ticket.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ticket
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { status, priority, subject, description } = req.body;
    const ticketId = req.params.id;
    
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Check if user can update this ticket
    if (req.user && req.user.role === 'user' && ticket.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Only agents and admins can update status
    if (status && req.user && req.user.role === 'user') {
      return res.status(403).json({ message: 'Only agents and admins can update ticket status' });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (subject) updateData.subject = subject;
    if (description) updateData.description = description;
    
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'category', select: 'name color' },
      { path: 'createdBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email' }
    ]);
    
    // Emit real-time updates
    const io = req.app.get('io');
    const emitToAll = req.app.get('emitToAll');
    const emitToUser = req.app.get('emitToUser');
    
    // Emit to all users
    emitToAll('ticket:updated', { ticket: updatedTicket });
    
    // Emit dashboard stats update
    emitToAll('dashboard:stats:updated', { type: 'ticket_updated' });
    
    // Emit notification to ticket creator
    if (updatedTicket.createdBy && updatedTicket.createdBy._id.toString() !== req.user.id) {
      emitToUser(updatedTicket.createdBy._id.toString(), 'notification:new', {
        type: 'ticket',
        title: 'Ticket Updated',
        message: `Your ticket "${updatedTicket.subject}" has been updated`,
        data: { ticketId: updatedTicket._id, subject: updatedTicket.subject }
      });
    }
    
    res.json({ ticket: updatedTicket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to ticket
router.post('/:id/comments', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { content } = req.body;
    const ticketId = req.params.id;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user can access this ticket
    const user = await User.findById(userId);
    if (user.role === 'user' && ticket.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path
        });
      }
    }

    const comment = {
      content: content.trim(),
      user: userId,
      attachments,
      createdAt: new Date()
    };

    ticket.comments.push(comment);
    await ticket.save();

    // Populate user info for the comment
    const populatedTicket = await ticket.populate([
      { path: 'comments.user', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email' },
      { path: 'category', select: 'name color' }
    ]);

    const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];

    // Send email notification to ticket creator and assigned agent
    const emailRecipients = new Set();
    
    if (ticket.createdBy && ticket.createdBy.toString() !== userId) {
      const creator = await User.findById(ticket.createdBy);
      if (creator) emailRecipients.add(creator.email);
    }
    
    if (ticket.assignedTo && ticket.assignedTo.toString() !== userId) {
      const assigned = await User.findById(ticket.assignedTo);
      if (assigned) emailRecipients.add(assigned.email);
    }

    // Send email notifications
    for (const email of emailRecipients) {
      try {
        await sendEmail({
          to: email,
          subject: `New Comment on Ticket: ${ticket.subject}`,
          template: 'newComment',
          data: {
            ticketSubject: ticket.subject,
            ticketId: ticket._id,
            commentContent: content,
            commenterName: req.user.name
          }
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    // Emit real-time updates
    const io = req.app.get('io');
    const emitToAll = req.app.get('emitToAll');
    const emitToUser = req.app.get('emitToUser');
    
    // Emit to all users
    emitToAll('ticket:commentAdded', { 
      ticketId, 
      comment: newComment,
      ticket: populatedTicket
    });
    
    // Emit notification to ticket creator and assigned agent
    if (ticket.createdBy && ticket.createdBy.toString() !== userId) {
      emitToUser(ticket.createdBy.toString(), 'notification:new', {
        type: 'comment',
        title: 'New Comment',
        message: `New comment added to ticket "${ticket.subject}"`,
        data: { ticketId: ticket._id, subject: ticket.subject }
      });
    }
    
    if (ticket.assignedTo && ticket.assignedTo.toString() !== userId) {
      emitToUser(ticket.assignedTo.toString(), 'notification:new', {
        type: 'comment',
        title: 'New Comment',
        message: `New comment added to ticket "${ticket.subject}"`,
        data: { ticketId: ticket._id, subject: ticket.subject }
      });
    }

    res.json({ 
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign ticket to agent
router.post('/:id/assign', authenticateToken, authorize(['agent', 'admin']), async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const ticketId = req.params.id;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // If assignedTo is empty, unassign the ticket
    if (!assignedTo) {
      ticket.assignedTo = null;
    } else {
      // Verify the assigned user exists and is an agent
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
      
      if (assignedUser.role !== 'agent' && assignedUser.role !== 'admin') {
        return res.status(400).json({ message: 'Can only assign to agents or admins' });
      }
      
      ticket.assignedTo = assignedTo;
    }

    await ticket.save();

    // Populate ticket for real-time updates
    const populatedTicket = await ticket.populate(['assignedTo', 'createdBy', 'category']);

    // Emit real-time updates
    const emitToAll = req.app.get('emitToAll');
    const emitToUser = req.app.get('emitToUser');
    
    // Emit to all users
    emitToAll('ticket:assigned', { ticket: populatedTicket });
    
    // Emit notification to assigned user
    if (ticket.assignedTo) {
      emitToUser(ticket.assignedTo.toString(), 'notification:new', {
        type: 'assignment',
        title: 'Ticket Assigned',
        message: `You have been assigned to ticket "${ticket.subject}"`,
        data: { ticketId: ticket._id, subject: ticket.subject }
      });
      
      // Send email notification to assigned user
      const assignedUser = await User.findById(ticket.assignedTo);
      if (assignedUser) {
        await sendEmail({
          to: assignedUser.email,
          subject: 'Ticket Assigned',
          template: 'ticketAssigned',
          data: {
            userName: assignedUser.name,
            ticketSubject: ticket.subject,
            ticketId: ticket._id
          }
        });
      }
    }

    res.json({ 
      message: 'Ticket assigned successfully',
      ticket: populatedTicket
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Vote on ticket
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { voteType } = req.body;
    const ticketId = req.params.id;
    const userId = req.user.id;

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const voteField = voteType === 'upvote' ? 'upvotes' : 'downvotes';
    const otherVoteField = voteType === 'upvote' ? 'downvotes' : 'upvotes';

    // Check if user already voted
    const hasVoted = ticket[voteField].includes(userId);
    const hasOtherVote = ticket[otherVoteField].includes(userId);

    if (hasVoted) {
      // Remove vote
      ticket[voteField] = ticket[voteField].filter(id => id.toString() !== userId);
    } else {
      // Add vote
      ticket[voteField].push(userId);
      
      // Remove other vote if exists
      if (hasOtherVote) {
        ticket[otherVoteField] = ticket[otherVoteField].filter(id => id.toString() !== userId);
      }
    }

    await ticket.save();

    res.json({ 
      message: 'Vote recorded successfully',
      upvotes: ticket.upvotes.length,
      downvotes: ticket.downvotes.length
    });
  } catch (error) {
    console.error('Error voting on ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export tickets
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'csv', search, status, category, priority, sort = '-createdAt' } = req.query;
    
    // Build query based on filters
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    // Get tickets with filters
    const tickets = await Ticket.find(query)
      .populate('category', 'name color')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort(sort);
    
    if (format === 'csv') {
      // Create CSV content
      const csvRows = [
        ['ID', 'Title', 'Description', 'Status', 'Priority', 'Category', 'Created By', 'Assigned To', 'Created At', 'Updated At', 'Resolved At']
      ];
      
      tickets.forEach(ticket => {
        csvRows.push([
          ticket._id,
          ticket.subject,
          ticket.description,
          ticket.status,
          ticket.priority,
          ticket.category?.name || 'N/A',
          ticket.createdBy?.name || 'N/A',
          ticket.assignedTo?.name || 'N/A',
          ticket.createdAt.toISOString(),
          ticket.updatedAt.toISOString(),
          ticket.resolvedAt?.toISOString() || 'N/A'
        ]);
      });
      
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=tickets-export-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: tickets.map(ticket => ({
          id: ticket._id,
          title: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category?.name,
          createdBy: ticket.createdBy?.name,
          assignedTo: ticket.assignedTo?.name,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          resolvedAt: ticket.resolvedAt
        })),
        total: tickets.length
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Error exporting tickets' });
  }
});

// Delete ticket
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Only owner or admin can delete
    if (req.user && req.user.role !== 'admin' && ticket.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this ticket' });
    }
    
    await Ticket.findByIdAndDelete(req.params.id);
    
    // Emit real-time updates
    const emitToAll = req.app.get('emitToAll');
    
    // Emit to all users
    emitToAll('ticket:deleted', { ticketId: req.params.id });
    
    // Emit dashboard stats update
    emitToAll('dashboard:stats:updated', { type: 'ticket_deleted' });
    
    res.json({
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 