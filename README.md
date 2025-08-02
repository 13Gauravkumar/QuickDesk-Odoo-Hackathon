# QuickDesk - Help Desk Solution

A simple, easy-to-use help desk solution where users can raise support tickets, and support staff can manage and resolve them efficiently.

## Features

### For End Users
- User registration and authentication
- Create tickets with subject, description, category, and attachments
- View ticket status and history
- Search and filter tickets (open/closed, category, sorting)
- Real-time updates and notifications
- Upvote/downvote functionality

### For Support Agents
- Dashboard with ticket queues
- Assign and update tickets
- Add comments and updates
- Real-time ticket management

### For Admins
- User management with roles and permissions
- Category management
- System-wide oversight

## Tech Stack

- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Authentication**: JWT with bcrypt
- **File Upload**: Multer
- **Email**: Nodemailer
- **Security**: Helmet, CORS, rate limiting

## Quick Start

1. **Install Dependencies**
   ```bash
   npm run install-all
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env` in backend directory
   - Update environment variables

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   ```

## Project Structure

```
QuickDesk/
├── frontend/          # React frontend
├── backend/           # Node.js backend
├── package.json       # Root package.json
└── README.md         # This file
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quickdesk
JWT_SECRET=your_jwt_secret_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
CLIENT_URL=http://localhost:3000
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Tickets
- `GET /api/tickets` - Get all tickets (with filters)
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/comments` - Add comment

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category (Admin only)

### Users
- `GET /api/users` - Get all users (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation and sanitization
- CORS protection
- Helmet security headers
- File upload restrictions

## Real-time Features

- Live ticket updates
- Real-time notifications
- Instant messaging between users and agents
- Live status changes

## License

MIT License 