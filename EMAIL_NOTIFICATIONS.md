# Email Notifications System

## Overview
The QuickDesk system now includes a comprehensive real-time email notification system that automatically sends emails when tickets are created, updated, assigned, or commented on.

## Features

### 1. Real-Time Email Notifications
- **Ticket Creation**: Email sent to ticket creator and admins
- **Status Updates**: Email sent to ticket creator when status changes
- **Ticket Assignment**: Email sent to assigned agent
- **New Comments**: Email sent to ticket creator and assigned agent

### 2. Smart Notification Logic
- Prevents duplicate notifications
- Respects user roles and permissions
- Configurable notification preferences
- Rate limiting to prevent spam

### 3. Professional Email Templates
- Responsive HTML design
- Company branding support
- Clear and informative content
- Professional styling

## Configuration

### Environment Variables
Add these to your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Notification Settings
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_RATE_LIMIT_PER_MINUTE=10
EMAIL_RATE_LIMIT_PER_HOUR=100
```

### Notification Configuration
The system uses `server/utils/notificationConfig.js` to manage notification settings:

```javascript
// Enable/disable specific notifications
emailNotifications: {
  enabled: true,
  ticketCreated: true,
  ticketStatusUpdated: true,
  ticketAssigned: true,
  newComment: true,
  newTicketToAdmins: true
}
```

## Email Templates

### 1. Ticket Created Notification
**Recipients**: Ticket creator, Admins
**Template**: `ticketCreated`
**Content**: Ticket details, creation time, status

### 2. Status Update Notification
**Recipients**: Ticket creator
**Template**: `ticketStatusUpdated`
**Content**: Previous status, new status, update time

### 3. Ticket Assignment Notification
**Recipients**: Assigned agent
**Template**: `ticketAssigned`
**Content**: Ticket subject, ID, assignment details

### 4. New Comment Notification
**Recipients**: Ticket creator, Assigned agent
**Template**: `newComment`
**Content**: Comment content, commenter name, ticket details

## Implementation Details

### Email Utility (`server/utils/email.js`)
```javascript
// Enhanced notification functions
const sendTicketCreatedNotification = async (ticket, user) => {
  // Sends notification to ticket creator
};

const sendTicketStatusUpdateNotification = async (ticket, user, oldStatus, newStatus) => {
  // Sends notification for status changes
};

const sendTicketAssignedNotification = async (ticket, assignedUser) => {
  // Sends notification to assigned agent
};

const sendCommentNotification = async (ticket, comment, commenter) => {
  // Sends notification for new comments
};
```

### Ticket Routes Integration
The notification system is integrated into all ticket-related endpoints:

1. **POST /api/tickets** - Ticket creation
2. **PATCH /api/tickets/:id** - Ticket updates
3. **POST /api/tickets/:id/assign** - Ticket assignment
4. **POST /api/tickets/:id/comments** - Comment addition

## Usage Examples

### Creating a Ticket
```javascript
// When a ticket is created, notifications are automatically sent
const ticket = await Ticket.create({
  subject: 'Technical Issue',
  description: 'Unable to access the system',
  category: 'technical',
  priority: 'high',
  createdBy: userId
});

// Email notifications are sent automatically
await sendTicketCreatedNotification(ticket, user);
await sendNewTicketNotificationToAdmins(ticket, user);
```

### Updating Ticket Status
```javascript
// When status is updated, notification is sent
const oldStatus = ticket.status;
ticket.status = 'in-progress';
await ticket.save();

// Email notification is sent automatically
await sendTicketStatusUpdateNotification(ticket, user, oldStatus, 'in-progress');
```

### Adding Comments
```javascript
// When a comment is added, notifications are sent
ticket.comments.push({
  content: 'Working on this issue',
  user: userId,
  createdAt: new Date()
});
await ticket.save();

// Email notifications are sent automatically
await sendCommentNotification(ticket, comment, user);
```

## Security Features

### 1. Rate Limiting
- Maximum 10 emails per minute
- Maximum 100 emails per hour
- 5-minute cooldown period between notifications

### 2. Permission Checks
- Only authorized users receive notifications
- Respects user roles and permissions
- Prevents notification spam

### 3. Error Handling
- Graceful failure if email sending fails
- Logs errors for debugging
- Continues operation even if notifications fail

## Customization

### 1. Email Templates
Templates are located in `server/utils/email.js`:

```javascript
const emailTemplates = {
  ticketCreated: (ticket, user) => ({
    subject: `Ticket Created: ${ticket.subject}`,
    html: `...`
  }),
  // Add more templates as needed
};
```

### 2. Notification Configuration
Modify `server/utils/notificationConfig.js`:

```javascript
const notificationConfig = {
  emailNotifications: {
    enabled: true,
    ticketCreated: true,
    // Add more notification types
  },
  recipients: {
    newTicket: {
      admins: true,
      agents: false,
      creator: true
    }
    // Configure recipients for each notification type
  }
};
```

### 3. Company Branding
Update the company information in the configuration:

```javascript
templates: {
  company: {
    name: 'Your Company Name',
    logo: 'https://your-domain.com/logo.png',
    website: 'https://your-domain.com',
    supportEmail: 'support@your-domain.com'
  }
}
```

## Testing

### 1. Test Email Configuration
```bash
# Check if email settings are working
npm test -- --grep "email"
```

### 2. Test Notifications
1. Create a test ticket
2. Update ticket status
3. Assign ticket to an agent
4. Add a comment
5. Check email inbox for notifications

### 3. Monitor Logs
```bash
# Check email sending logs
tail -f logs/email.log
```

## Troubleshooting

### Common Issues

1. **Emails Not Sending**
   - Check SMTP configuration
   - Verify email credentials
   - Check firewall settings

2. **Rate Limiting**
   - Reduce notification frequency
   - Increase rate limits in config
   - Check for notification loops

3. **Template Issues**
   - Verify HTML syntax
   - Check variable names
   - Test template rendering

### Debug Mode
Enable debug logging:

```javascript
// In your .env file
DEBUG_EMAIL=true
NODE_ENV=development
```

## Performance Considerations

### 1. Email Queue
For high-volume systems, consider implementing an email queue:

```javascript
// Example with Bull queue
const emailQueue = new Bull('email-queue');
emailQueue.process(async (job) => {
  await sendEmail(job.data);
});
```

### 2. Batch Notifications
For multiple notifications, consider batching:

```javascript
// Send multiple notifications at once
const notifications = [
  { type: 'ticketCreated', data: {...} },
  { type: 'statusUpdated', data: {...} }
];
await sendBatchNotifications(notifications);
```

### 3. Caching
Cache user preferences and notification settings:

```javascript
// Cache notification preferences
const userPrefs = await cache.get(`user:${userId}:notifications`);
if (userPrefs.emailEnabled) {
  await sendNotification(email, data);
}
```

## Future Enhancements

### 1. User Preferences
- Allow users to customize notification preferences
- Email frequency settings
- Notification type preferences

### 2. Advanced Templates
- Dynamic content based on ticket type
- Multi-language support
- Rich media attachments

### 3. Analytics
- Track email open rates
- Monitor notification effectiveness
- User engagement metrics

---

**Note**: This email notification system is designed to be reliable, scalable, and user-friendly. Always test thoroughly in development before deploying to production. 