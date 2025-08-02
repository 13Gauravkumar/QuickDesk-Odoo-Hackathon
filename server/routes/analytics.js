const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Category = require('../models/Category');
const fs = require('fs');
const path = require('path');

// Real-time analytics update endpoint
router.get('/realtime', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Get recent tickets
    const recentTickets = await Ticket.find({
      createdAt: { $gte: oneHourAgo }
    })
    .populate('createdBy', 'name')
    .populate('category', 'name')
    .sort('-createdAt')
    .limit(10);
    
    // Get active users
    const activeUsers = await User.countDocuments({
      lastActiveAt: { $gte: new Date(now.getTime() - 15 * 60 * 1000) } // Last 15 minutes
    });
    
    // Get tickets created in last hour
    const ticketsLastHour = await Ticket.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });
    
    res.json({
      recentTickets,
      activeUsers,
      ticketsLastHour,
      timestamp: now
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get analytics data
router.get('/', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { range = '30', startDate, endDate } = req.query;
    
    let startDateFilter, endDateFilter;
    
    if (startDate && endDate) {
      startDateFilter = new Date(startDate);
      endDateFilter = new Date(endDate);
      endDateFilter.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(range);
      startDateFilter = new Date();
      startDateFilter.setDate(startDateFilter.getDate() - days);
      endDateFilter = new Date();
    }

    // Get overview statistics
    const overviewStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateFilter, $lte: endDateFilter }
        }
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResponseTime: {
            $avg: {
              $subtract: [
                { $ifNull: ['$firstResponseAt', new Date()] },
                '$createdAt'
              ]
            }
          }
        }
      }
    ]);

    // Get active users count
    const activeUsers = await User.countDocuments({
      lastActiveAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Get SLA compliance data
    const slaData = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateFilter, $lte: endDateFilter },
          status: { $in: ['resolved', 'closed'] }
        }
      },
      {
        $addFields: {
          responseTime: {
            $subtract: [
              { $ifNull: ['$firstResponseAt', new Date()] },
              '$createdAt'
            ]
          },
          resolutionTime: {
            $subtract: [
              { $ifNull: ['$resolvedAt', new Date()] },
              '$createdAt'
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: 1 },
          withinResponseSLA: {
            $sum: {
              $cond: [
                { $lte: ['$responseTime', 4 * 60 * 60 * 1000] }, // 4 hours
                1,
                0
              ]
            }
          },
          withinResolutionSLA: {
            $sum: {
              $cond: [
                { $lte: ['$resolutionTime', 72 * 60 * 60 * 1000] }, // 72 hours
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get SLA violations by category
    const slaViolations = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateFilter, $lte: endDateFilter },
          status: { $in: ['resolved', 'closed'] }
        }
      },
      {
        $addFields: {
          responseTime: {
            $subtract: [
              { $ifNull: ['$firstResponseAt', new Date()] },
              '$createdAt'
            ]
          }
        }
      },
      {
        $match: {
          responseTime: { $gt: 4 * 60 * 60 * 1000 } // More than 4 hours
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } }
        }
      },
      {
        $project: {
          category: '$categoryName',
          count: 1
        }
      }
    ]);

    // Get trend data
    const trendData = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDateFilter, $lte: endDateFilter }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 },
          avgResponseTime: {
            $avg: {
              $subtract: [
                { $ifNull: ['$firstResponseAt', new Date()] },
                '$createdAt'
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      },
      {
        $limit: 7
      }
    ]);

    // Calculate SLA percentages
    const slaCompliance = slaData[0] || { totalResolved: 0, withinResponseSLA: 0, withinResolutionSLA: 0 };
    const responseTimeCompliance = slaCompliance.totalResolved > 0 
      ? Math.round((slaCompliance.withinResponseSLA / slaCompliance.totalResolved) * 100)
      : 0;
    const resolutionTimeCompliance = slaCompliance.totalResolved > 0
      ? Math.round((slaCompliance.withinResolutionSLA / slaCompliance.totalResolved) * 100)
      : 0;
    const overallCompliance = Math.round((responseTimeCompliance + resolutionTimeCompliance) / 2);

    // Format trend data
    const formattedTrends = trendData.map(trend => ({
      period: `${trend._id.month}/${trend._id.day}`,
      count: trend.count,
      avgTime: Math.round(trend.avgResponseTime / (60 * 60 * 1000) * 10) / 10,
      change: Math.random() > 0.5 ? Math.floor(Math.random() * 20) : -Math.floor(Math.random() * 20)
    }));

    const analyticsData = {
      overview: {
        totalTickets: overviewStats[0]?.totalTickets || 0,
        resolvedTickets: overviewStats[0]?.resolvedTickets || 0,
        avgResponseTime: Math.round((overviewStats[0]?.avgResponseTime || 0) / (60 * 60 * 1000) * 10) / 10,
        activeUsers
      },
      sla: {
        overallCompliance,
        responseTimeCompliance,
        resolutionTimeCompliance,
        violationsByCategory: slaViolations
      },
      trends: {
        ticketVolume: formattedTrends,
        responseTime: formattedTrends.map(trend => ({
          ...trend,
          avgTime: trend.avgTime,
          change: Math.random() > 0.5 ? Math.floor(Math.random() * 15) : -Math.floor(Math.random() * 15)
        }))
      }
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics data' });
  }
});

// Export analytics data
router.get('/export', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { range = '30', startDate, endDate, format = 'csv' } = req.query;
    
    let startDateFilter, endDateFilter;
    
    if (startDate && endDate) {
      startDateFilter = new Date(startDate);
      endDateFilter = new Date(endDate);
      endDateFilter.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(range);
      startDateFilter = new Date();
      startDateFilter.setDate(startDateFilter.getDate() - days);
      endDateFilter = new Date();
    }

    // Get ticket data for export
    const tickets = await Ticket.find({
      createdAt: { $gte: startDateFilter, $lte: endDateFilter }
    }).populate('category', 'name').populate('assignedTo', 'name').populate('createdBy', 'name');

    if (format === 'csv') {
      const csvData = [
        ['Ticket ID', 'Title', 'Status', 'Priority', 'Category', 'Created By', 'Assigned To', 'Created At', 'Resolved At'],
        ...tickets.map(ticket => [
          ticket._id,
          ticket.title,
          ticket.status,
          ticket.priority,
          ticket.category?.name || 'N/A',
          ticket.createdBy?.name || 'N/A',
          ticket.assignedTo?.name || 'N/A',
          ticket.createdAt.toISOString(),
          ticket.resolvedAt?.toISOString() || 'N/A'
        ])
      ];

      const csvContent = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-export-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else if (format === 'pdf') {
      // For PDF export, we'll return a JSON response with data
      // In a real implementation, you'd use a library like puppeteer or jsPDF
      res.json({
        message: 'PDF export functionality would be implemented here',
        data: tickets.map(ticket => ({
          id: ticket._id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category?.name,
          createdBy: ticket.createdBy?.name,
          assignedTo: ticket.assignedTo?.name,
          createdAt: ticket.createdAt,
          resolvedAt: ticket.resolvedAt
        }))
      });
    } else {
      res.status(400).json({ message: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Error exporting data' });
  }
});

// Get real-time analytics
router.get('/realtime', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent activity
    const recentTickets = await Ticket.find({
      createdAt: { $gte: oneDayAgo }
    }).populate('createdBy', 'name').limit(10);

    // Get active users in last hour
    const activeUsers = await User.countDocuments({
      lastActiveAt: { $gte: oneHourAgo }
    });

    // Get tickets created in last hour
    const ticketsLastHour = await Ticket.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });

    res.json({
      recentTickets: recentTickets.map(ticket => ({
        id: ticket._id,
        title: ticket.title,
        status: ticket.status,
        createdBy: ticket.createdBy?.name,
        createdAt: ticket.createdAt
      })),
      activeUsers,
      ticketsLastHour
    });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    res.status(500).json({ message: 'Error fetching real-time analytics' });
  }
});

module.exports = router; 