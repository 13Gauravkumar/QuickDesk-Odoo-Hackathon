const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Category = require('../models/Category');

// @route   GET /api/dashboard/recommendations
// @desc    Get AI-powered recommendations for the dashboard
// @access  Private
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const recommendations = [];

    // Get ticket statistics
    const ticketStats = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          overdueTickets: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'open'] },
                    { $lt: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] }
                  ]
                },
                1,
                0
              ]
            }
          },
          highPriorityTickets: {
            $sum: {
              $cond: [
                { $in: ['$priority', ['urgent', 'high']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = ticketStats[0] || {};

    // Generate recommendations based on data analysis
    if (stats.overdueTickets > 0) {
      recommendations.push({
        title: 'Overdue Tickets Need Attention',
        description: `${stats.overdueTickets} tickets are overdue and require immediate attention.`,
        type: 'urgent',
        action: 'review_overdue_tickets',
        priority: 'high'
      });
    }

    if (stats.highPriorityTickets > 3) {
      recommendations.push({
        title: 'High Priority Tickets Piling Up',
        description: `${stats.highPriorityTickets} high priority tickets need immediate resolution.`,
        type: 'warning',
        action: 'prioritize_high_priority',
        priority: 'medium'
      });
    }

    // Check for unassigned tickets
    const unassignedCount = await Ticket.countDocuments({
      assignedTo: { $exists: false },
      status: { $in: ['open', 'in-progress'] }
    });

    if (unassignedCount > 0) {
      recommendations.push({
        title: 'Unassigned Tickets',
        description: `${unassignedCount} tickets need to be assigned to agents.`,
        type: 'info',
        action: 'assign_tickets',
        priority: 'medium'
      });
    }

    // Check agent workload
    const agentWorkload = await Ticket.aggregate([
      {
        $match: { 
          assignedTo: { $exists: true },
          status: { $in: ['open', 'in-progress'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          ticketCount: { $sum: 1 }
        }
      }
    ]);

    const highWorkloadAgents = agentWorkload.filter(agent => agent.ticketCount > 5);
    if (highWorkloadAgents.length > 0) {
      recommendations.push({
        title: 'Agent Workload Distribution',
        description: `${highWorkloadAgents.length} agents have high workload and may need support.`,
        type: 'info',
        action: 'redistribute_workload',
        priority: 'low'
      });
    }

    // Performance recommendations
    const avgResponseTime = await calculateAverageResponseTime();
    if (avgResponseTime > 4) {
      recommendations.push({
        title: 'Response Time Optimization',
        description: `Average response time is ${avgResponseTime.toFixed(1)} hours. Consider improving response times.`,
        type: 'warning',
        action: 'optimize_response_time',
        priority: 'medium'
      });
    }

    // Knowledge base recommendations
    const commonIssues = await findCommonIssues();
    if (commonIssues.length > 0) {
      recommendations.push({
        title: 'Knowledge Base Enhancement',
        description: `${commonIssues.length} common issues detected. Consider adding to knowledge base.`,
        type: 'info',
        action: 'enhance_knowledge_base',
        priority: 'low'
      });
    }

    // Sort recommendations by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    res.json(recommendations.slice(0, 5));
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ message: 'Error generating recommendations' });
  }
});

// Helper function to calculate average response time
const calculateAverageResponseTime = async () => {
  try {
    const responseTimeData = await Ticket.aggregate([
      {
        $match: {
          firstResponseAt: { $exists: true },
          createdAt: { $exists: true }
        }
      },
      {
        $addFields: {
          responseTime: {
            $divide: [
              { $subtract: ['$firstResponseAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    return responseTimeData[0]?.avgResponseTime || 0;
  } catch (error) {
    console.error('Error calculating average response time:', error);
    return 0;
  }
};

// Helper function to find common issues
const findCommonIssues = async () => {
  try {
    const commonIssues = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gte: 3 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $project: {
          category: { $arrayElemAt: ['$categoryInfo.name', 0] },
          count: 1
        }
      }
    ]);

    return commonIssues;
  } catch (error) {
    console.error('Error finding common issues:', error);
    return [];
  }
};

// @route   GET /api/dashboard/insights
// @desc    Get real-time insights for the dashboard
// @access  Private
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get today's activity
    const todayStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: oneDayAgo }
        }
      },
      {
        $group: {
          _id: null,
          ticketsCreated: { $sum: 1 },
          ticketsResolved: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'resolved'] }, { $gte: ['$resolvedAt', oneDayAgo] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get weekly trends
    const weeklyTrends = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get top categories
    const topCategories = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      }
    ]);

    // Get agent performance
    const agentPerformance = await Ticket.aggregate([
      {
        $match: {
          assignedTo: { $exists: true },
          status: { $in: ['resolved', 'closed'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          resolvedTickets: { $sum: 1 },
          avgResolutionTime: {
            $avg: {
              $divide: [
                { $subtract: ['$resolvedAt', '$createdAt'] },
                1000 * 60 * 60 // Convert to hours
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agentInfo'
        }
      },
      {
        $sort: { resolvedTickets: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      today: todayStats[0] || { ticketsCreated: 0, ticketsResolved: 0 },
      weeklyTrends,
      topCategories,
      agentPerformance
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ message: 'Error fetching insights' });
  }
});

// @route   GET /api/dashboard/notifications
// @desc    Get recent notifications for the dashboard
// @access  Private
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = [];

    // Check for urgent tickets
    const urgentTickets = await Ticket.countDocuments({
      priority: 'urgent',
      status: { $in: ['open', 'in-progress'] }
    });

    if (urgentTickets > 0) {
      notifications.push({
        type: 'urgent',
        message: `${urgentTickets} urgent tickets require immediate attention`,
        timestamp: new Date(),
        action: 'view_urgent_tickets'
      });
    }

    // Check for overdue tickets
    const overdueTickets = await Ticket.countDocuments({
      status: 'open',
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (overdueTickets > 0) {
      notifications.push({
        type: 'warning',
        message: `${overdueTickets} tickets are overdue`,
        timestamp: new Date(),
        action: 'review_overdue_tickets'
      });
    }

    // Check for new tickets in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const newTickets = await Ticket.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });

    if (newTickets > 0) {
      notifications.push({
        type: 'info',
        message: `${newTickets} new tickets created in the last hour`,
        timestamp: new Date(),
        action: 'view_recent_tickets'
      });
    }

    // Check for resolved tickets today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = await Ticket.countDocuments({
      status: 'resolved',
      resolvedAt: { $gte: today }
    });

    if (resolvedToday > 0) {
      notifications.push({
        type: 'success',
        message: `${resolvedToday} tickets resolved today`,
        timestamp: new Date(),
        action: 'view_resolved_tickets'
      });
    }

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

module.exports = router; 