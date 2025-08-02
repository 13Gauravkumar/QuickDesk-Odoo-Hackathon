const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// Protect routes - verify token
const authenticateToken = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

// Check if user can access ticket (owner or agent/admin)
const canAccessTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Admin and agents can access all tickets
    if (req.user.role === 'admin' || req.user.role === 'agent') {
      req.ticket = ticket;
      return next();
    }

    // Users can only access their own tickets
    if (ticket.createdBy.toString() === req.user._id.toString()) {
      req.ticket = ticket;
      return next();
    }

    return res.status(403).json({ message: 'Not authorized to access this ticket' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  authorize,
  canAccessTicket
}; 