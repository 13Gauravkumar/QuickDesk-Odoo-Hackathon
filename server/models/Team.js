const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  permissions: {
    canInvite: { type: Boolean, default: false },
    canRemoveMembers: { type: Boolean, default: false },
    canManageTickets: { type: Boolean, default: true },
    canViewAnalytics: { type: Boolean, default: true }
  }
});

const teamChatMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    filename: String,
    originalname: String,
    size: Number,
    mimetype: String,
    path: String
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  avatar: {
    type: String,
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [teamMemberSchema],
  settings: {
    isPublic: { type: Boolean, default: false },
    allowMemberInvites: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    maxMembers: { type: Number, default: 50 }
  },
  chat: {
    messages: [teamChatMessageSchema],
    lastActivity: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
  },
  stats: {
    totalTickets: { type: Number, default: 0 },
    activeTickets: { type: Number, default: 0 },
    resolvedTickets: { type: Number, default: 0 },
    avgResolutionTime: { type: Number, default: 0 }
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
teamSchema.index({ name: 'text', description: 'text' });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ owner: 1 });

// Virtuals
teamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

teamSchema.virtual('isFull').get(function() {
  return this.members.length >= this.settings.maxMembers;
});

// Methods
teamSchema.methods.addMember = async function(userId, role = 'member') {
  if (this.isFull) {
    throw new Error('Team is at maximum capacity');
  }
  
  const existingMember = this.members.find(m => m.user.toString() === userId);
  if (existingMember) {
    throw new Error('User is already a member of this team');
  }
  
  const permissions = this.getDefaultPermissions(role);
  this.members.push({
    user: userId,
    role,
    permissions
  });
  
  return this.save();
};

teamSchema.methods.removeMember = async function(userId) {
  const memberIndex = this.members.findIndex(m => m.user.toString() === userId);
  if (memberIndex === -1) {
    throw new Error('User is not a member of this team');
  }
  
  if (this.members[memberIndex].role === 'owner') {
    throw new Error('Cannot remove team owner');
  }
  
  this.members.splice(memberIndex, 1);
  return this.save();
};

teamSchema.methods.updateMemberRole = async function(userId, newRole) {
  const member = this.members.find(m => m.user.toString() === userId);
  if (!member) {
    throw new Error('User is not a member of this team');
  }
  
  member.role = newRole;
  member.permissions = this.getDefaultPermissions(newRole);
  return this.save();
};

teamSchema.methods.addChatMessage = async function(senderId, content, messageType = 'text', attachments = []) {
  const message = {
    sender: senderId,
    content,
    messageType,
    attachments,
    createdAt: new Date()
  };
  
  this.chat.messages.push(message);
  this.chat.lastActivity = new Date();
  
  return this.save();
};

teamSchema.methods.getDefaultPermissions = function(role) {
  const permissions = {
    canInvite: false,
    canRemoveMembers: false,
    canManageTickets: true,
    canViewAnalytics: true
  };
  
  switch (role) {
    case 'owner':
      permissions.canInvite = true;
      permissions.canRemoveMembers = true;
      break;
    case 'admin':
      permissions.canInvite = true;
      permissions.canRemoveMembers = true;
      break;
    case 'member':
    default:
      break;
  }
  
  return permissions;
};

teamSchema.methods.hasPermission = function(userId, permission) {
  const member = this.members.find(m => m.user.toString() === userId);
  if (!member) return false;
  
  return member.permissions[permission] || false;
};

teamSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId);
};

teamSchema.methods.isOwner = function(userId) {
  return this.owner.toString() === userId;
};

// Pre-save middleware
teamSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Team', teamSchema); 