const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send email
const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const message = {
      from: `${process.env.EMAIL_USER}`,
      to: options.email,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(message);
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

// Enhanced notification functions
const sendTicketCreatedNotification = async (ticket, user) => {
  try {
    const template = emailTemplates.ticketCreated(ticket, user);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      html: template.html
    });
    console.log(`Ticket creation notification sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send ticket creation notification:', error);
  }
};

const sendTicketStatusUpdateNotification = async (ticket, user, oldStatus, newStatus) => {
  try {
    const template = emailTemplates.ticketStatusUpdated(ticket, user, oldStatus, newStatus);
    await sendEmail({
      email: user.email,
      subject: template.subject,
      html: template.html
    });
    console.log(`Status update notification sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send status update notification:', error);
  }
};

const sendTicketAssignedNotification = async (ticket, assignedUser) => {
  try {
    const template = emailTemplates.ticketAssigned({
      userName: assignedUser.name,
      ticketSubject: ticket.subject,
      ticketId: ticket._id
    });
    await sendEmail({
      email: assignedUser.email,
      subject: template.subject,
      html: template.html
    });
    console.log(`Assignment notification sent to ${assignedUser.email}`);
  } catch (error) {
    console.error('Failed to send assignment notification:', error);
  }
};

const sendNewTicketNotificationToAdmins = async (ticket, creator) => {
  try {
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      const template = emailTemplates.newTicket({
        userName: creator.name,
        ticketSubject: ticket.subject,
        ticketId: ticket._id
      });
      
      await sendEmail({
        email: admin.email,
        subject: template.subject,
        html: template.html
      });
      console.log(`New ticket notification sent to admin ${admin.email}`);
    }
  } catch (error) {
    console.error('Failed to send new ticket notification to admins:', error);
  }
};

const sendCommentNotification = async (ticket, comment, commenter) => {
  try {
    // Notify ticket creator if comment is from someone else
    if (ticket.createdBy.toString() !== commenter._id.toString()) {
      const User = require('../models/User');
      const ticketCreator = await User.findById(ticket.createdBy);
      
      if (ticketCreator) {
        const template = emailTemplates.newComment({
          ticketSubject: ticket.subject,
          ticketId: ticket._id,
          commenterName: commenter.name,
          commentContent: comment.content
        });
        
        await sendEmail({
          email: ticketCreator.email,
          subject: template.subject,
          html: template.html
        });
        console.log(`Comment notification sent to ticket creator ${ticketCreator.email}`);
      }
    }
    
    // Notify assigned agent if different from commenter
    if (ticket.assignedTo && ticket.assignedTo.toString() !== commenter._id.toString()) {
      const User = require('../models/User');
      const assignedAgent = await User.findById(ticket.assignedTo);
      
      if (assignedAgent) {
        const template = emailTemplates.newComment({
          ticketSubject: ticket.subject,
          ticketId: ticket._id,
          commenterName: commenter.name,
          commentContent: comment.content
        });
        
        await sendEmail({
          email: assignedAgent.email,
          subject: template.subject,
          html: template.html
        });
        console.log(`Comment notification sent to assigned agent ${assignedAgent.email}`);
      }
    }
  } catch (error) {
    console.error('Failed to send comment notification:', error);
  }
};

// Email templates
const emailTemplates = {
  ticketCreated: (ticket, user) => ({
    subject: `Ticket Created: ${ticket.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Ticket Created Successfully</h2>
        <p>Hello ${user.name},</p>
        <p>Your ticket has been created successfully. Here are the details:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Ticket Details:</h3>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Category:</strong> ${ticket.category.name}</p>
          <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
        </div>
        <p>We'll notify you when there are updates to your ticket.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  }),

  ticketStatusUpdated: (ticket, user, oldStatus, newStatus) => ({
    subject: `Ticket Status Updated: ${ticket.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Ticket Status Update</h2>
        <p>Hello ${user.name},</p>
        <p>Your ticket status has been updated. Here are the details:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Ticket Details:</h3>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Previous Status:</strong> ${oldStatus}</p>
          <p><strong>New Status:</strong> ${newStatus}</p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Updated:</strong> ${new Date(ticket.updatedAt).toLocaleString()}</p>
        </div>
        <p>Please log in to view the complete details and any additional updates.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  }),

  ticketUpdated: (ticket, user, updateType) => ({
    subject: `Ticket Updated: ${ticket.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Ticket Update</h2>
        <p>Hello ${user.name},</p>
        <p>Your ticket has been updated. Here are the details:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Ticket Details:</h3>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p><strong>Update Type:</strong> ${updateType}</p>
          <p><strong>Last Updated:</strong> ${new Date(ticket.updatedAt).toLocaleString()}</p>
        </div>
        <p>Please log in to view the complete details.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  }),

  ticketAssigned: (data) => ({
    subject: `Ticket Assigned: ${data.ticketSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Ticket Assigned</h2>
        <p>Hello ${data.userName},</p>
        <p>A ticket has been assigned to you:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${data.ticketSubject}</h3>
          <p><strong>Ticket ID:</strong> #${data.ticketId}</p>
        </div>
        <p>Please review and respond to this ticket as soon as possible.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  }),

  newComment: (data) => ({
    subject: `New Comment on Ticket: ${data.ticketSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Comment Added</h2>
        <p>A new comment has been added to ticket: <strong>${data.ticketSubject}</strong></p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Comment by:</strong> ${data.commenterName}</p>
          <p><strong>Comment:</strong></p>
          <p style="background-color: white; padding: 15px; border-radius: 4px; margin: 10px 0;">
            ${data.commentContent}
          </p>
        </div>
        <p>Ticket ID: #${data.ticketId}</p>
        <p>Please log in to view the full ticket and respond if needed.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  }),

  newTicket: (data) => ({
    subject: `New Ticket Created: ${data.ticketSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Ticket Created</h2>
        <p>A new support ticket has been created by ${data.userName}.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${data.ticketSubject}</h3>
          <p><strong>Ticket ID:</strong> #${data.ticketId}</p>
          <p><strong>Created By:</strong> ${data.userName}</p>
        </div>
        <p>Please review and assign this ticket to an appropriate agent.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  emailTemplates,
  sendTicketCreatedNotification,
  sendTicketStatusUpdateNotification,
  sendTicketAssignedNotification,
  sendNewTicketNotificationToAdmins,
  sendCommentNotification
}; 