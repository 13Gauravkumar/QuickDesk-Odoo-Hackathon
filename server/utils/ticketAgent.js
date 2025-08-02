const { aiSearch, generateAISuggestions } = require('./openai');
const Ticket = require('../models/Ticket');
const Category = require('../models/Category');
const User = require('../models/User');

let openai = null;

// Initialize OpenAI client only if API key is available
if (process.env.OPENAI_API_KEY) {
  const OpenAI = require('openai');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * AI Ticket Resolution Agent
 * This agent can analyze tickets, provide intelligent responses, and auto-resolve common issues
 */
class TicketResolutionAgent {
  constructor() {
    this.knowledgeBase = [];
    this.resolutionTemplates = {
      login: {
        title: 'Login Issue Resolution',
        content: 'I can help you resolve your login issue. Please try the following steps:\n1. Clear your browser cache and cookies\n2. Try using a different browser\n3. Reset your password using the "Forgot Password" link\n4. If the issue persists, please provide more details about the error message you\'re seeing.',
        autoResolve: true,
        confidence: 0.9
      },
      password: {
        title: 'Password Reset Assistance',
        content: 'I\'ll help you reset your password. Please check your email for the password reset link. If you don\'t receive it within 5 minutes, check your spam folder. You can also contact support if you need immediate assistance.',
        autoResolve: true,
        confidence: 0.85
      },
      upload: {
        title: 'File Upload Issue Resolution',
        content: 'I can help you with file upload issues. Please ensure:\n1. File size is under 5MB\n2. File type is supported (images, PDFs, documents)\n3. Your internet connection is stable\n4. Try uploading one file at a time',
        autoResolve: true,
        confidence: 0.8
      },
      performance: {
        title: 'Performance Issue Resolution',
        content: 'For performance issues, please try:\n1. Refresh the page\n2. Clear browser cache\n3. Try a different browser\n4. Check your internet connection\n5. If problems persist, please provide specific details about the performance issue.',
        autoResolve: false,
        confidence: 0.7
      }
    };
  }

  /**
   * Analyze a ticket and provide intelligent response
   * @param {Object} ticket - The ticket object
   * @param {Array} knowledgeBase - Available knowledge base articles
   * @returns {Promise<Object>} - AI response with resolution suggestions
   */
  async analyzeTicket(ticket, knowledgeBase = []) {
    try {
      if (!openai || !process.env.OPENAI_API_KEY) {
        return this.fallbackAnalysis(ticket, knowledgeBase);
      }

      const systemPrompt = `You are an AI support agent for QuickDesk. Your task is to:
1. Analyze the ticket description and identify the issue type
2. Provide a helpful, professional response
3. Suggest relevant knowledge base articles
4. Determine if the issue can be auto-resolved
5. Provide step-by-step resolution steps

Available knowledge base articles:
${knowledgeBase.map(article => `
Title: ${article.title}
Category: ${article.category}
Content: ${article.content.substring(0, 200)}...
`).join('\n')}

Ticket Information:
Subject: ${ticket.subject}
Description: ${ticket.description}
Category: ${ticket.category}
Priority: ${ticket.priority}
Status: ${ticket.status}

Please provide a JSON response with:
{
  "analysis": {
    "issueType": "string",
    "confidence": "number (0-1)",
    "canAutoResolve": "boolean",
    "estimatedResolutionTime": "string"
  },
  "response": {
    "message": "string",
    "suggestedArticles": ["array of article IDs"],
    "resolutionSteps": ["array of steps"],
    "nextActions": ["array of actions"]
  }
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Analyze this ticket and provide a resolution plan: ${ticket.description}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const aiResponse = completion.choices[0].message.content;
      
      try {
        const parsedResponse = JSON.parse(aiResponse);
        return {
          ...parsedResponse,
          enhancedByAI: true,
          timestamp: new Date()
        };
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        return this.fallbackAnalysis(ticket, knowledgeBase);
      }

    } catch (error) {
      console.error('AI analysis error:', error);
      return this.fallbackAnalysis(ticket, knowledgeBase);
    }
  }

  /**
   * Fallback analysis when AI is not available
   * @param {Object} ticket - The ticket object
   * @param {Array} knowledgeBase - Available knowledge base articles
   * @returns {Object} - Basic analysis
   */
  fallbackAnalysis(ticket, knowledgeBase) {
    const description = ticket.description.toLowerCase();
    let issueType = 'general';
    let confidence = 0.5;
    let canAutoResolve = false;

    // Simple keyword-based analysis
    if (description.includes('login') || description.includes('sign in')) {
      issueType = 'login';
      confidence = 0.8;
      canAutoResolve = true;
    } else if (description.includes('password') || description.includes('reset')) {
      issueType = 'password';
      confidence = 0.85;
      canAutoResolve = true;
    } else if (description.includes('upload') || description.includes('file')) {
      issueType = 'upload';
      confidence = 0.7;
      canAutoResolve = true;
    } else if (description.includes('slow') || description.includes('performance')) {
      issueType = 'performance';
      confidence = 0.6;
      canAutoResolve = false;
    }

    const template = this.resolutionTemplates[issueType] || this.resolutionTemplates.performance;

    return {
      analysis: {
        issueType,
        confidence,
        canAutoResolve,
        estimatedResolutionTime: canAutoResolve ? '5-10 minutes' : '1-2 hours'
      },
      response: {
        message: template.content,
        suggestedArticles: knowledgeBase
          .filter(article => article.category === ticket.category || article.tags?.includes(issueType))
          .slice(0, 3)
          .map(article => article._id),
        resolutionSteps: this.generateResolutionSteps(issueType),
        nextActions: this.generateNextActions(issueType, canAutoResolve)
      },
      enhancedByAI: false,
      timestamp: new Date()
    };
  }

  /**
   * Generate resolution steps based on issue type
   * @param {string} issueType - Type of issue
   * @returns {Array} - Array of resolution steps
   */
  generateResolutionSteps(issueType) {
    const steps = {
      login: [
        'Clear browser cache and cookies',
        'Try using a different browser',
        'Check if caps lock is on',
        'Reset your password if needed'
      ],
      password: [
        'Click "Forgot Password" on login page',
        'Enter your email address',
        'Check your email for reset link',
        'Create a new password'
      ],
      upload: [
        'Check file size (max 5MB)',
        'Ensure file type is supported',
        'Try uploading one file at a time',
        'Check internet connection'
      ],
      performance: [
        'Refresh the page',
        'Clear browser cache',
        'Try a different browser',
        'Check internet connection',
        'Contact support if issue persists'
      ]
    };

    return steps[issueType] || steps.performance;
  }

  /**
   * Generate next actions based on issue type and auto-resolve capability
   * @param {string} issueType - Type of issue
   * @param {boolean} canAutoResolve - Whether issue can be auto-resolved
   * @returns {Array} - Array of next actions
   */
  generateNextActions(issueType, canAutoResolve) {
    if (canAutoResolve) {
      return [
        'Follow the resolution steps provided',
        'Try the suggested solution',
        'Mark as resolved if issue is fixed',
        'Contact support if problem persists'
      ];
    }

    return [
      'Try the basic troubleshooting steps',
      'Provide more details about the issue',
      'Wait for agent response',
      'Check knowledge base for similar issues'
    ];
  }

  /**
   * Auto-resolve a ticket if possible
   * @param {Object} ticket - The ticket object
   * @param {Object} analysis - AI analysis result
   * @returns {Promise<Object>} - Resolution result
   */
  async autoResolveTicket(ticket, analysis) {
    try {
      if (!analysis.analysis.canAutoResolve) {
        return {
          success: false,
          reason: 'Issue cannot be auto-resolved',
          requiresAgent: true
        };
      }

      // Add AI response as a comment
      const comment = {
        content: analysis.response.message,
        author: 'AI Agent',
        timestamp: new Date(),
        isAIResponse: true,
        confidence: analysis.analysis.confidence
      };

      // Update ticket status
      ticket.status = 'resolved';
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = 'AI Agent';
      ticket.comments.push(comment);
      ticket.resolutionTime = Math.round((ticket.resolvedAt - ticket.createdAt) / (1000 * 60));

      await ticket.save();

      return {
        success: true,
        message: 'Ticket auto-resolved by AI agent',
        resolutionTime: ticket.resolutionTime,
        confidence: analysis.analysis.confidence
      };

    } catch (error) {
      console.error('Error auto-resolving ticket:', error);
      return {
        success: false,
        reason: 'Error during auto-resolution',
        error: error.message
      };
    }
  }

  /**
   * Generate intelligent response for a ticket
   * @param {Object} ticket - The ticket object
   * @param {Array} knowledgeBase - Available knowledge base articles
   * @returns {Promise<Object>} - Response with suggestions
   */
  async generateResponse(ticket, knowledgeBase = []) {
    const analysis = await this.analyzeTicket(ticket, knowledgeBase);
    
    // Try to auto-resolve if possible
    const resolutionResult = await this.autoResolveTicket(ticket, analysis);
    
    return {
      analysis,
      resolutionResult,
      suggestedArticles: knowledgeBase.filter(article => 
        analysis.response.suggestedArticles.includes(article._id)
      ),
      nextActions: analysis.response.nextActions,
      canAutoResolve: analysis.analysis.canAutoResolve
    };
  }

  /**
   * Batch analyze multiple tickets
   * @param {Array} tickets - Array of ticket objects
   * @param {Array} knowledgeBase - Available knowledge base articles
   * @returns {Promise<Array>} - Array of analysis results
   */
  async batchAnalyzeTickets(tickets, knowledgeBase = []) {
    const results = [];
    
    for (const ticket of tickets) {
      try {
        const analysis = await this.analyzeTicket(ticket, knowledgeBase);
        results.push({
          ticketId: ticket._id,
          analysis,
          canAutoResolve: analysis.analysis.canAutoResolve
        });
      } catch (error) {
        console.error(`Error analyzing ticket ${ticket._id}:`, error);
        results.push({
          ticketId: ticket._id,
          error: error.message,
          canAutoResolve: false
        });
      }
    }
    
    return results;
  }

  /**
   * Get agent statistics
   * @returns {Object} - Agent performance statistics
   */
  async getAgentStats() {
    try {
      const stats = await Ticket.aggregate([
        {
          $match: {
            resolvedBy: 'AI Agent'
          }
        },
        {
          $group: {
            _id: null,
            totalResolved: { $sum: 1 },
            avgResolutionTime: { $avg: '$resolutionTime' },
            avgConfidence: { $avg: '$comments.confidence' }
          }
        }
      ]);

      return stats[0] || {
        totalResolved: 0,
        avgResolutionTime: 0,
        avgConfidence: 0
      };
    } catch (error) {
      console.error('Error getting agent stats:', error);
      return {
        totalResolved: 0,
        avgResolutionTime: 0,
        avgConfidence: 0
      };
    }
  }
}

module.exports = TicketResolutionAgent; 