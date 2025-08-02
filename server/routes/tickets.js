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
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { status, priority, category, search, sortBy, sortOrder } = req.query;
    
    // Build query
    let query = {};
    
    // Role-based filtering
    if (req.user.role === 'user') {
      query.createdBy = req.user.id;
    } else if (req.user.role === 'agent') {
      // Agents can see tickets assigned to them or unassigned tickets
      query.$or = [
        { assignedTo: req.user.id },
        { assignedTo: null }
      ];
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Priority filter
    if (priority) {
      query.priority = priority;
    }
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort object
    let sort = {};
    if (sortBy === 'recent') {
      sort.lastActivity = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'created') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'priority') {
      sort.priority = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort.createdAt = -1; // Default sort by newest
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
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets
// @desc    Create a new ticket
// @access  Private
router.post('/', upload.array('attachments', 5), [
  body('subject', 'Subject is required').not().isEmpty(),
  body('description', 'Description is required').not().isEmpty(),
  body('category', 'Category is required').not().isEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { subject, description, category, priority = 'medium', tags } = req.body;
    
    // Validate category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: 'Category not found' });
    }
    
    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    const ticket = new Ticket({
      subject,
      description,
      category,
      priority,
      createdBy: req.user.id,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      attachments
    });
    
    await ticket.save();
    
    // Populate references
    await ticket.populate('category', 'name color');
    await ticket.populate('createdBy', 'name email');
    
    // Send email notification
    try {
      const emailTemplate = emailTemplates.ticketCreated(ticket, req.user);
      await sendEmail({
        email: req.user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:created', { ticket });
    
    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get single ticket
// @access  Private
router.get('/:id', canAccessTicket, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('category', 'name color')
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'name email avatar'
        }
      });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tickets/:id
// @desc    Update ticket
// @access  Private (Owner, Agent, Admin)
router.put('/:id', canAccessTicket, upload.array('attachments', 5), async (req, res) => {
  try {
    const { subject, description, priority, status, category, tags } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Only agents and admins can change status
    if (status && req.user.role === 'user') {
      return res.status(403).json({ message: 'Not authorized to change status' });
    }
    
    // Update fields
    if (subject) ticket.subject = subject;
    if (description) ticket.description = description;
    if (priority) ticket.priority = priority;
    if (category) ticket.category = category;
    if (tags) ticket.tags = tags.split(',').map(tag => tag.trim());
    
    // Handle status change
    if (status && status !== ticket.status) {
      await ticket.updateStatus(status, req.user.id);
    } else {
      await ticket.save();
    }
    
    // Process new attachments
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      }));
      ticket.attachments.push(...newAttachments);
      await ticket.save();
    }
    
    await ticket.populate('category', 'name color');
    await ticket.populate('createdBy', 'name email');
    await ticket.populate('assignedTo', 'name email');
    
    // Send email notification for status change
    if (status && status !== ticket.status) {
      try {
        const emailTemplate = emailTemplates.ticketUpdated(ticket, req.user, 'Status Update');
        await sendEmail({
          email: req.user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:updated', { ticket });
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tickets/:id/comments
// @desc    Add comment to ticket
// @access  Private
router.post('/:id/comments', canAccessTicket, upload.array('attachments', 5), [
  body('content', 'Comment content is required').not().isEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { content, isInternal = false } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Process attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    // Add comment
    await ticket.addComment(content, req.user.id, isInternal, attachments);
    
    // Populate comment author
    const populatedTicket = await Ticket.findById(req.params.id)
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
          select: 'name email avatar'
        }
      });
    
    const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];
    
    // Send email notification
    try {
      const emailTemplate = emailTemplates.newComment(ticket, req.user, newComment);
      await sendEmail({
        email: req.user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:comment', { ticketId: ticket._id, comment: newComment });
    
    res.json({
      success: true,
      data: newComment
    });
  } catch (error) {
    console.error(error);
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

    // Send email notification to assigned user
    if (ticket.assignedTo) {
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
      ticket: await ticket.populate(['assignedTo', 'createdBy', 'category'])
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

// @route   DELETE /api/tickets/:id
// @desc    Delete ticket
// @access  Private (Owner, Admin)
router.delete('/:id', canAccessTicket, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    
    // Only owner or admin can delete
    if (req.user.role !== 'admin' && ticket.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this ticket' });
    }
    
    await Ticket.findByIdAndDelete(req.params.id);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:deleted', { ticketId: req.params.id });
    
    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error(error);
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
    if (user.role !== 'admin') {
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

module.exports = router; 