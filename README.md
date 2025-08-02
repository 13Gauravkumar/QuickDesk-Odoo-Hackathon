# QuickDesk - Help Desk Management System

A modern, real-time help desk solution built with the MERN stack (MongoDB, Express.js, React, Node.js) featuring Socket.IO for real-time updates, comprehensive security measures, and a responsive UI.

## TEAM MEMBERS

 1. SAHIL GUPTA
 2. GAURAV KUMAR
 3. HARSH KUMAR

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**: Secure JWT-based authentication with role-based access control
- **Ticket Management**: Create, update, assign, and track support tickets
- **Real-time Updates**: Live notifications and updates using Socket.IO
- **File Attachments**: Support for file uploads in tickets and comments
- **Email Notifications**: Automated email notifications for ticket events
- **Voting System**: Upvote/downvote tickets for community feedback
- **Search & Filtering**: Advanced search and filtering capabilities
- **Responsive Design**: Mobile-first, responsive UI

### Role-Based Access
- **End Users**: Create tickets, track status, add comments
- **Support Agents**: Manage tickets, assign to agents, update status
- **Administrators**: User management, category management, system oversight

### Security Features
- JWT token authentication
- Password encryption with bcrypt
- Rate limiting
- Input sanitization
- XSS protection
- CORS configuration
- Helmet security headers

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **Socket.IO** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads
- **Nodemailer** - Email notifications
- **Express Validator** - Input validation

### Frontend
- **React 18** - UI library
- **React Router** - Navigation
- **React Query** - Data fetching
- **React Hook Form** - Form management
- **Socket.IO Client** - Real-time updates
- **Tailwind CSS** - Styling
- **Heroicons** - Icons
- **React Hot Toast** - Notifications
- **Framer Motion** - Animations

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd QuickDesk
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment example
   cp env.example .env
   
   # Edit .env file with your configuration
   nano .env
   ```

4. **Configure Environment Variables**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/quickdesk
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   
   # Email Configuration (for notifications)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   
   # File Upload Configuration
   MAX_FILE_SIZE=5242880
   UPLOAD_PATH=./uploads
   
   # Security Configuration
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX=100
   
   # Client URL
   CLIENT_URL=http://localhost:3000
   ```

5. **Start MongoDB**
   ```bash
   # Start MongoDB service
   mongod
   ```

6. **Run the application**
   ```bash
   # Development mode (runs both server and client)
   npm run dev
   
   # Or run separately:
   # Server only
   npm run server
   
   # Client only
   cd client && npm start
   ```

## 📁 Project Structure

```
QuickDesk/
├── server/
│   ├── models/
│   │   ├── User.js
│   │   ├── Ticket.js
│   │   └── Category.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tickets.js
│   │   ├── categories.js
│   │   └── users.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── email.js
│   └── index.js
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   └── package.json
├── uploads/
├── package.json
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Tickets
- `GET /api/tickets` - Get all tickets (with filters)
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get single ticket
- `PUT /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket
- `POST /api/tickets/:id/comments` - Add comment
- `POST /api/tickets/:id/assign` - Assign ticket
- `POST /api/tickets/:id/vote` - Vote on ticket

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/agents` - Get all agents
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

## 🎨 UI Features

### Dashboard
- Overview statistics
- Recent tickets
- Quick actions
- Real-time updates

### Ticket Management
- Create tickets with attachments
- Filter and search tickets
- Status tracking
- Comment system
- Voting system

### Admin Panel
- User management
- Category management
- System statistics
- Bulk operations

## 🔒 Security Features

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting
- **File Upload Security**: File type and size validation
- **XSS Protection**: Cross-site scripting protection
- **CORS**: Cross-origin resource sharing configuration

## 📱 Real-time Features

- Live ticket updates
- Real-time notifications
- Instant comment updates
- Status change notifications
- Connection status indicator

## 🚀 Deployment

### Production Build
```bash
# Build client
cd client
npm run build

# Start production server
npm start
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
CLIENT_URL=https://your-domain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- Real-time ticket management
- Role-based access control
- File upload support
- Email notifications
- Responsive UI

---

**QuickDesk** - Streamlining support ticket management with modern technology and real-time collaboration. 
