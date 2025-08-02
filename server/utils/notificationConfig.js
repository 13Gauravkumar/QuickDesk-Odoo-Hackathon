// Email Notification Configuration
const notificationConfig = {
  // Enable/disable email notifications
  emailNotifications: {
    enabled: true,
    ticketCreated: true,
    ticketStatusUpdated: true,
    ticketAssigned: true,
    newComment: true,
    newTicketToAdmins: true
  },

  // Notification recipients configuration
  recipients: {
    // Who should receive notifications for new tickets
    newTicket: {
      admins: true,
      agents: false,
      creator: true
    },

    // Who should receive notifications for status changes
    statusUpdate: {
      creator: true,
      assignedAgent: true,
      admins: false
    },

    // Who should receive notifications for assignments
    assignment: {
      assignedAgent: true,
      creator: false,
      admins: false
    },

    // Who should receive notifications for comments
    comment: {
      creator: true,
      assignedAgent: true,
      commenter: false
    }
  },

  // Email template customization
  templates: {
    // Company branding
    company: {
      name: 'QuickDesk',
      logo: 'https://your-domain.com/logo.png',
      website: 'https://your-domain.com',
      supportEmail: 'support@your-domain.com'
    },

    // Email styling
    styling: {
      primaryColor: '#3B82F6',
      secondaryColor: '#1F2937',
      backgroundColor: '#F9FAFB',
      textColor: '#374151'
    }
  },

  // Rate limiting for email notifications
  rateLimiting: {
    enabled: true,
    maxEmailsPerMinute: 10,
    maxEmailsPerHour: 100,
    cooldownPeriod: 300000 // 5 minutes in milliseconds
  },

  // Notification preferences per user role
  rolePreferences: {
    admin: {
      ticketCreated: true,
      ticketStatusUpdated: true,
      ticketAssigned: false,
      newComment: false,
      priority: 'high'
    },
    agent: {
      ticketCreated: false,
      ticketStatusUpdated: true,
      ticketAssigned: true,
      newComment: true,
      priority: 'medium'
    },
    user: {
      ticketCreated: true,
      ticketStatusUpdated: true,
      ticketAssigned: false,
      newComment: true,
      priority: 'low'
    }
  }
};

// Helper functions for notification configuration
const getNotificationConfig = (notificationType, userRole = 'user') => {
  const config = {
    enabled: notificationConfig.emailNotifications[notificationType] || false,
    roleEnabled: notificationConfig.rolePreferences[userRole]?.[notificationType] || false,
    recipients: notificationConfig.recipients[notificationType] || {}
  };
  
  return config;
};

const shouldSendNotification = (notificationType, userRole = 'user') => {
  const config = getNotificationConfig(notificationType, userRole);
  return config.enabled && config.roleEnabled;
};

const getRecipientsForNotification = (notificationType, ticket, currentUser) => {
  const config = notificationConfig.recipients[notificationType] || {};
  const recipients = [];

  if (config.creator && ticket.createdBy && ticket.createdBy.toString() !== currentUser.id) {
    recipients.push(ticket.createdBy);
  }

  if (config.assignedAgent && ticket.assignedTo && ticket.assignedTo.toString() !== currentUser.id) {
    recipients.push(ticket.assignedTo);
  }

  if (config.admins) {
    // This will be handled separately in the email utility
    recipients.push('admins');
  }

  return recipients;
};

module.exports = {
  notificationConfig,
  getNotificationConfig,
  shouldSendNotification,
  getRecipientsForNotification
}; 