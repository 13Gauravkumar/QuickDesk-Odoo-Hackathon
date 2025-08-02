const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin only)
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { role, search, isActive } = req.query;
    
    // Build query
    let query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: users,
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

// @route   GET /api/users/agents
// @desc    Get all agents (for ticket assignment)
// @access  Private (Agent, Admin)
router.get('/agents', authorize('agent', 'admin'), async (req, res) => {
  try {
    const agents = await User.find({ 
      role: { $in: ['agent', 'admin'] },
      isActive: true 
    })
    .select('name email role')
    .sort({ name: 1 });
    
    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private (Admin only)
router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin only)
router.put('/:id', authorize('admin'), [
  body('name', 'Name is required').not().isEmpty(),
  body('email', 'Please include a valid email').isEmail(),
  body('role', 'Role must be user, agent, or admin').isIn(['user', 'agent', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, role, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if email is being changed and if it conflicts with existing user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    
    await user.save();
    
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user has any tickets
    const userTickets = await Ticket.countDocuments({
      $or: [
        { createdBy: req.params.id },
        { assignedTo: req.params.id }
      ]
    });
    
    if (userTickets > 0) {
      return res.status(400).json({ 
        message: `Cannot delete user. They have ${userTickets} associated ticket(s).` 
      });
    }
    
    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error(error);
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

module.exports = router; 