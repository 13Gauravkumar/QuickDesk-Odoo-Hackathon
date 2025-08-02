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

  newComment: (ticket, user, comment) => ({
    subject: `New Comment on Ticket: ${ticket.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">New Comment</h2>
        <p>Hello ${user.name},</p>
        <p>A new comment has been added to your ticket:</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Ticket Details:</h3>
          <p><strong>Subject:</strong> ${ticket.subject}</p>
          <p><strong>Comment:</strong> ${comment.content}</p>
          <p><strong>By:</strong> ${comment.author.name}</p>
          <p><strong>Time:</strong> ${new Date(comment.createdAt).toLocaleString()}</p>
        </div>
        <p>Please log in to respond if needed.</p>
        <p>Best regards,<br>QuickDesk Team</p>
      </div>
    `
  })
};

module.exports = {
  sendEmail,
  emailTemplates
}; 