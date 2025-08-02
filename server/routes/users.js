const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password');
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get agents only
router.get('/agents', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const agents = await User.find({ 
      role: { $in: ['agent', 'admin'] },
      isActive: true 
    }).select('-password');
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user (Admin only)
router.post('/', authenticateToken, authorize(['admin']), [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['user', 'agent', 'admin']).withMessage('Valid role is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true
    });

    await user.save();

    // Emit real-time event
    const emitToAll = req.app.get('emitToAll');
    emitToAll('user:created', { user: { id: user._id, name: user.name, email: user.email, role: user.role } });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single user
router.get('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user
router.patch('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    const userId = req.params.id;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Emit real-time event
    const emitToAll = req.app.get('emitToAll');
    emitToAll('user:updated', { user: { id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });

    res.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Soft delete user
router.delete('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Emit real-time event
    const emitToAll = req.app.get('emitToAll');
    emitToAll('user:deleted', { userId: user._id, userName: user.name });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get user statistics
// @access  Private (Admin only)
router.get('/stats/overview', authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalAgents = await User.countDocuments({ 
      role: { $in: ['agent', 'admin'] },
      isActive: true 
    });
    const totalAdmins = await User.countDocuments({ 
      role: 'admin',
      isActive: true 
    });
    
    // Get recent registrations
    const recentUsers = await User.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get user activity (users with recent tickets)
    const activeUserIds = await Ticket.distinct('createdBy', {
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });
    
    const activeUsersCount = await User.countDocuments({
      _id: { $in: activeUserIds },
      isActive: true
    });
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalAgents,
        totalAdmins,
        activeUsersCount,
        recentUsers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/tickets
// @desc    Get user's tickets
// @access  Private (Admin only)
router.get('/:id/tickets', authorize('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const tickets = await Ticket.find({
      $or: [
        { createdBy: req.params.id },
        { assignedTo: req.params.id }
      ]
    })
    .populate('category', 'name color')
    .populate('createdBy', 'name email')
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Ticket.countDocuments({
      $or: [
        { createdBy: req.params.id },
        { assignedTo: req.params.id }
      ]
    });
    
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

// @route   POST /api/users/bulk-update
// @desc    Bulk update users
// @access  Private (Admin only)
router.post('/bulk-update', authorize('admin'), [
  body('userIds', 'User IDs are required').isArray(),
  body('updates', 'Updates are required').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { userIds, updates } = req.body;
    
    // Validate updates
    const allowedUpdates = ['role', 'isActive'];
    const updateFields = Object.keys(updates);
    const invalidFields = updateFields.filter(field => !allowedUpdates.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({ 
        message: `Invalid update fields: ${invalidFields.join(', ')}` 
      });
    }
    
    // Update users
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updates }
    );
    
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} users`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/export
// @desc    Export user data
// @access  Private (User can export their own data)
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const userId = req.user.id;
    
    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user's tickets
    const tickets = await Ticket.find({
      $or: [
        { createdBy: userId },
        { assignedTo: userId }
      ]
    })
    .populate('category', 'name color')
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });
    
    // Prepare export data
    const exportData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      },
      tickets: tickets.map(ticket => ({
        id: ticket._id,
        title: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category?.name || 'N/A',
        createdBy: ticket.createdBy?.name || 'N/A',
        assignedTo: ticket.assignedTo?.name || 'N/A',
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt
      })),
      exportDate: new Date().toISOString(),
      totalTickets: tickets.length
    };
    
    if (format === 'csv') {
      // Create CSV content
      const csvRows = [
        ['User Information'],
        ['ID', 'Name', 'Email', 'Role', 'Created At'],
        [user._id, user.name, user.email, user.role, user.createdAt.toISOString()],
        [],
        ['Tickets'],
        ['ID', 'Title', 'Status', 'Priority', 'Category', 'Created By', 'Assigned To', 'Created At', 'Resolved At']
      ];
      
      tickets.forEach(ticket => {
        csvRows.push([
          ticket._id,
          ticket.subject,
          ticket.status,
          ticket.priority,
          ticket.category?.name || 'N/A',
          ticket.createdBy?.name || 'N/A',
          ticket.assignedTo?.name || 'N/A',
          ticket.createdAt.toISOString(),
          ticket.resolvedAt?.toISOString() || 'N/A'
        ]);
      });
      
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user-data-${user.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: exportData
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Error exporting data' });
  }
});

module.exports = router; 