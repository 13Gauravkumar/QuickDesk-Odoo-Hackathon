const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const availabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
});

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const performanceSchema = new mongoose.Schema({
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  ticketsResolved: {
    type: Number,
    default: 0
  },
  avgResolutionTime: {
    type: Number, // in minutes
    default: 0
  },
  customerSatisfaction: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  responseTime: {
    type: Number, // in minutes
    default: 0
  },
  slaCompliance: {
    type: Number, // percentage
    default: 0
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'agent', 'admin', 'supervisor'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: ''
  },
  // Profile Information
  phone: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Availability & Schedule
  availability: [availabilitySchema],
  timezone: {
    type: String,
    default: 'UTC'
  },
  workingHours: {
    start: {
      type: String,
      default: '09:00'
    },
    end: {
      type: String,
      default: '17:00'
    }
  },
  // Skills & Expertise
  skills: [skillSchema],
  expertise: [{
    type: String,
    trim: true
  }],
  // Performance & Metrics
  performance: [performanceSchema],
  totalTicketsResolved: {
    type: Number,
    default: 0
  },
  avgResolutionTime: {
    type: Number, // in minutes
    default: 0
  },
  customerSatisfaction: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    autoAssign: {
      type: Boolean,
      default: true
    },
    maxTickets: {
      type: Number,
      default: 10
    }
  },
  // Status & Activity
  isActive: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  // Security & Verification
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // Social Login
  socialLogins: [{
    provider: {
      type: String,
      enum: ['google', 'github', 'microsoft', 'linkedin']
    },
    providerId: String,
    accessToken: String,
    refreshToken: String
  }],
  // API Access
  apiKey: String,
  apiKeyExpires: Date,
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for current workload
userSchema.virtual('currentWorkload').get(function() {
  // This would be calculated dynamically
  return 0;
});

// Virtual for performance rating
userSchema.virtual('performanceRating').get(function() {
  if (this.customerSatisfaction === 0) return 'N/A';
  if (this.customerSatisfaction >= 4.5) return 'Excellent';
  if (this.customerSatisfaction >= 4.0) return 'Good';
  if (this.customerSatisfaction >= 3.5) return 'Average';
  return 'Needs Improvement';
});

// Indexes for better performance
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ 'skills.name': 1 });
userSchema.index({ lastActiveAt: -1 });
userSchema.index({ totalTicketsResolved: -1 });

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate API key
userSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  this.apiKey = crypto.randomBytes(32).toString('hex');
  this.apiKeyExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return this.apiKey;
};

// Check if user is available
userSchema.methods.isAvailable = function() {
  if (!this.isActive || !this.isOnline) return false;
  
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const time = now.toLocaleTimeString('en-US', { hour12: false });
  
  const availability = this.availability.find(a => a.day === day);
  if (!availability || !availability.isAvailable) return false;
  
  return time >= availability.startTime && time <= availability.endTime;
};

// Update last activity
userSchema.methods.updateActivity = function() {
  this.lastActiveAt = new Date();
  this.isOnline = true;
  return this.save();
};

// Return user without sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorSecret;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpire;
  delete user.apiKey;
  delete user.apiKeyExpires;
  return user;
};

module.exports = mongoose.model('User', userSchema); 