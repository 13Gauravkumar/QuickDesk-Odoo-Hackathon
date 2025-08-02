const express = require('express');
const multer = require('multer');
const path = require('path');
const Team = require('../models/Team');
const User = require('../models/User');
const { authenticateToken, authorize } = require('../middleware/auth');

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

// @route   GET /api/teams
// @desc    Get all teams for the user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, sort = '-updatedAt', page = 0, limit = 10 } = req.query;
    const skip = page * limit;
    
    let query = {
      $or: [
        { owner: req.user.id },
        { 'members.user': req.user.id }
      ]
    };
    
    if (search) {
      query.$and = [{
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      }];
    }
    
    const teams = await Team.find(query)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Team.countDocuments(query);
    
    res.json({
      teams,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/teams
// @desc    Create a new team
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPublic, allowMemberInvites, requireApproval, maxMembers } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Team name is required' });
    }
    
    // Check if team name already exists
    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return res.status(400).json({ message: 'Team name already exists' });
    }
    
    const team = new Team({
      name,
      description,
      owner: req.user.id,
      settings: {
        isPublic: isPublic || false,
        allowMemberInvites: allowMemberInvites !== false,
        requireApproval: requireApproval || false,
        maxMembers: maxMembers || 50
      }
    });
    
    // Add owner as first member
    team.members.push({
      user: req.user.id,
      role: 'owner',
      permissions: team.getDefaultPermissions('owner')
    });
    
    await team.save();
    
    // Populate references
    await team.populate([
      { path: 'owner', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' }
    ]);
    
    res.status(201).json({ team });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/teams/:id
// @desc    Get single team details
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .populate('chat.messages.sender', 'name email avatar');
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user has access to this team
    if (!team.isMember(req.user.id) && !team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ team });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team details
// @access  Private (Owner/Admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user can update team
    if (!team.isOwner(req.user.id) && !team.hasPermission(req.user.id, 'canManageTickets')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (settings) updateData.settings = { ...team.settings, ...settings };
    
    const updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'owner', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' }
    ]);
    
    res.json({ team: updatedTeam });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/teams/:id/members
// @desc    Add member to team
// @access  Private (Owner/Admin)
router.post('/:id/members', authenticateToken, async (req, res) => {
  try {
    const { userId, role = 'member' } = req.body;
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user can add members
    if (!team.isOwner(req.user.id) && !team.hasPermission(req.user.id, 'canInvite')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await team.addMember(userId, role);
    
    // Populate references
    await team.populate([
      { path: 'owner', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' }
    ]);
    
    res.json({ team });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   DELETE /api/teams/:id/members/:userId
// @desc    Remove member from team
// @access  Private (Owner/Admin)
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user can remove members
    if (!team.isOwner(req.user.id) && !team.hasPermission(req.user.id, 'canRemoveMembers')) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await team.removeMember(req.params.userId);
    
    // Populate references
    await team.populate([
      { path: 'owner', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' }
    ]);
    
    res.json({ team });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   PUT /api/teams/:id/members/:userId/role
// @desc    Update member role
// @access  Private (Owner)
router.put('/:id/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body;
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Only owner can change roles
    if (!team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await team.updateMemberRole(req.params.userId, role);
    
    // Populate references
    await team.populate([
      { path: 'owner', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' }
    ]);
    
    res.json({ team });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   POST /api/teams/:id/chat
// @desc    Send message to team chat
// @access  Private (Team members)
router.post('/:id/chat', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user is team member
    if (!team.isMember(req.user.id) && !team.isOwner(req.user.id)) {
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
    
    await team.addChatMessage(req.user.id, content.trim(), messageType, attachments);
    
    // Populate message sender
    const populatedTeam = await team.populate('chat.messages.sender', 'name email avatar');
    const newMessage = populatedTeam.chat.messages[populatedTeam.chat.messages.length - 1];
    
    // Emit real-time updates
    const emitToAll = req.app.get('emitToAll');
    emitToAll('team:message:new', {
      teamId: team._id,
      message: newMessage
    });
    
    res.json({ message: newMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/teams/:id/chat
// @desc    Get team chat messages
// @access  Private (Team members)
router.get('/:id/chat', authenticateToken, async (req, res) => {
  try {
    const { page = 0, limit = 50 } = req.query;
    const skip = page * limit;
    
    const team = await Team.findById(req.params.id)
      .populate('chat.messages.sender', 'name email avatar')
      .populate('chat.messages.mentions', 'name email avatar');
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user is team member
    if (!team.isMember(req.user.id) && !team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get paginated messages
    const messages = team.chat.messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + parseInt(limit))
      .reverse();
    
    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: team.chat.messages.length,
        totalPages: Math.ceil(team.chat.messages.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/teams/:id/chat/:messageId/reactions
// @desc    Add reaction to message
// @access  Private (Team members)
router.post('/:id/chat/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user is team member
    if (!team.isMember(req.user.id) && !team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const message = team.chat.messages.id(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      r => r.user.toString() === req.user.id && r.emoji === emoji
    );
    
    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        r => !(r.user.toString() === req.user.id && r.emoji === emoji)
      );
    } else {
      // Add reaction
      message.reactions.push({
        user: req.user.id,
        emoji
      });
    }
    
    await team.save();
    
    res.json({ message: 'Reaction updated successfully' });
  } catch (error) {
    console.error('Error updating reaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/teams/:id/stats
// @desc    Get team statistics
// @access  Private (Team members)
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if user is team member
    if (!team.isMember(req.user.id) && !team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Calculate team statistics
    const memberIds = team.members.map(m => m.user);
    memberIds.push(team.owner);
    
    const stats = {
      totalMembers: team.members.length + 1, // +1 for owner
      activeMembers: team.members.length + 1,
      totalMessages: team.chat.messages.length,
      lastActivity: team.chat.lastActivity,
      teamStats: team.stats
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching team stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team
// @access  Private (Owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Only owner can delete team
    if (!team.isOwner(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await Team.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 