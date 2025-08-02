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
    
    const { search, status, category, priority, sort = '-createdAt' } = req.query;
    
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
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:created', { ticket });
    
    res.status(201).json({ ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
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
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:updated', { ticket: updatedTicket });
    
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

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:commentAdded', { 
      ticketId, 
      comment: newComment,
      ticket: populatedTicket
    });

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
    
    // Emit real-time update
    const io = req.app.get('io');
    io.emit('ticket:deleted', { ticketId: req.params.id });
    
    res.json({
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
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

module.exports = router; 