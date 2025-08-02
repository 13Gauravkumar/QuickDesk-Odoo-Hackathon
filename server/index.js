const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const categoryRoutes = require('./routes/categories');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const knowledgeBaseRoutes = require('./routes/knowledge-base');
const dashboardRoutes = require('./routes/dashboard');
const automationRoutes = require('./routes/automation');
const chatbotRoutes = require('./routes/chatbot');
const reportRoutes = require('./routes/reports');
const teamRoutes = require('./routes/teams');
const { authenticateToken } = require('./middleware/auth');
const { sendEmail } = require('./utils/email');

const app = express();
app.set('trust proxy', 1); // Trust first proxy
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX),
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(mongoSanitize());
app.use(xss());
app.use(compression());

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} joined`);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    console.log('User disconnected:', socket.id);
  });

  // Handle real-time notifications
  socket.on('notification:send', (data) => {
    const { userId, notification } = data;
    const targetSocketId = connectedUsers.get(userId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('notification:new', notification);
    }
  });

  // Handle real-time updates for all users
  socket.on('broadcast:update', (data) => {
    io.emit('realtime:update', data);
  });
});

// Make io available to routes
app.set('io', io);

// Helper function to emit real-time events
const emitToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

const emitToAll = (event, data) => {
  io.emit(event, data);
};

// Make helper functions available to routes
app.set('emitToUser', emitToUser);
app.set('emitToAll', emitToAll);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/teams', teamRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 