const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Category = require('../models/Category');

// @route   GET /api/analytics/performance
// @desc    Get real-time performance metrics
// @access  Private
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Real-time ticket statistics
    const ticketStats = await Ticket.aggregate([
      {
        $facet: {
          total: [
            { $count: 'count' }
          ],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 }
              }
            }
          ],
          todayCreated: [
            {
              $match: {
                createdAt: { $gte: oneDayAgo }
              }
            },
            { $count: 'count' }
          ],
          todayResolved: [
            {
              $match: {
                status: 'resolved',
                resolvedAt: { $gte: oneDayAgo }
              }
            },
            { $count: 'count' }
          ],
          overdue: [
            {
              $match: {
                status: 'open',
                createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Response time analytics
    const responseTimeStats = await Ticket.aggregate([
      {
        $match: {
          firstResponseAt: { $exists: true },
          createdAt: { $gte: oneMonthAgo }
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
          avgResponseTime: { $avg: '$responseTime' },
          minResponseTime: { $min: '$responseTime' },
          maxResponseTime: { $max: '$responseTime' }
        }
      }
    ]);

    // Agent performance
    const agentPerformance = await Ticket.aggregate([
      {
        $match: {
          assignedTo: { $exists: true },
          status: { $in: ['resolved', 'closed'] },
          resolvedAt: { $gte: oneMonthAgo }
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
                1000 * 60 * 60
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
      }
    ]);

    // Category performance
    const categoryStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          totalTickets: { $sum: 1 },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'resolved'] },
                {
                  $divide: [
                    { $subtract: ['$resolvedAt', '$createdAt'] },
                    1000 * 60 * 60
                  ]
                },
                null
              ]
            }
          }
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
        $sort: { totalTickets: -1 }
      }
    ]);

    // Weekly trends
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
          created: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'resolved'] }, { $gte: ['$resolvedAt', { $dateFromString: { dateString: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }, '-', { $toString: '$_id.day' }] } } }] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // System health metrics
    const systemHealth = {
      database: 'healthy',
      emailService: 'operational',
      realTimeUpdates: 'active',
      lastUpdate: new Date(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    // SLA compliance
    const slaCompliance = await Ticket.aggregate([
      {
        $match: {
          status: { $in: ['resolved', 'closed'] },
          resolvedAt: { $gte: oneMonthAgo }
        }
      },
      {
        $addFields: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalResolved: { $sum: 1 },
          withinSLA: {
            $sum: {
              $cond: [
                { $lte: ['$resolutionTime', 24] }, // 24-hour SLA
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const slaPercentage = slaCompliance[0] 
      ? (slaCompliance[0].withinSLA / slaCompliance[0].totalResolved) * 100 
      : 100;

    const result = {
      realTime: {
        totalTickets: ticketStats[0].total[0]?.count || 0,
        openTickets: ticketStats[0].byStatus.find(s => s._id === 'open')?.count || 0,
        inProgressTickets: ticketStats[0].byStatus.find(s => s._id === 'in-progress')?.count || 0,
        resolvedTickets: ticketStats[0].byStatus.find(s => s._id === 'resolved')?.count || 0,
        todayCreated: ticketStats[0].todayCreated[0]?.count || 0,
        todayResolved: ticketStats[0].todayResolved[0]?.count || 0,
        overdueTickets: ticketStats[0].overdue[0]?.count || 0,
        urgentTickets: ticketStats[0].byPriority.find(p => p._id === 'urgent')?.count || 0,
        highPriorityTickets: ticketStats[0].byPriority.find(p => p._id === 'high')?.count || 0
      },
      performance: {
        avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0,
        minResponseTime: responseTimeStats[0]?.minResponseTime || 0,
        maxResponseTime: responseTimeStats[0]?.maxResponseTime || 0,
        slaCompliance: slaPercentage,
        resolutionRate: ticketStats[0].todayResolved[0]?.count / Math.max(ticketStats[0].todayCreated[0]?.count || 1, 1) * 100
      },
      agentPerformance: agentPerformance.slice(0, 5),
      categoryStats: categoryStats.slice(0, 5),
      weeklyTrends,
      systemHealth,
      lastUpdate: new Date()
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({ message: 'Error fetching performance analytics' });
  }
});

// @route   GET /api/analytics/realtime
// @desc    Get real-time dashboard data
// @access  Private
router.get('/realtime', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Real-time activity
    const recentActivity = await Ticket.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: oneHourAgo } },
            { updatedAt: { $gte: oneHourAgo } }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assignee'
        }
      },
      {
        $sort: { updatedAt: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Live metrics
    const liveMetrics = await Ticket.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 }
              }
            }
          ],
          unassigned: [
            {
              $match: {
                assignedTo: { $exists: false },
                status: { $in: ['open', 'in-progress'] }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Active agents
    const activeAgents = await User.aggregate([
      {
        $match: {
          role: { $in: ['admin', 'agent'] },
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'tickets',
          localField: '_id',
          foreignField: 'assignedTo',
          as: 'assignedTickets'
        }
      },
      {
        $addFields: {
          activeTickets: {
            $size: {
              $filter: {
                input: '$assignedTickets',
                cond: { $in: ['$$this.status', ['open', 'in-progress']] }
              }
            }
          }
        }
      },
      {
        $sort: { activeTickets: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // System status
    const systemStatus = {
      database: 'connected',
      emailService: 'operational',
      realTimeUpdates: 'active',
      lastUpdate: new Date(),
      activeConnections: Math.floor(Math.random() * 50) + 10, // Simulated
      serverLoad: Math.floor(Math.random() * 30) + 5, // Simulated
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    res.json({
      recentActivity,
      liveMetrics: {
        total: liveMetrics[0].total[0]?.count || 0,
        byStatus: liveMetrics[0].byStatus,
        byPriority: liveMetrics[0].byPriority,
        unassigned: liveMetrics[0].unassigned[0]?.count || 0
      },
      activeAgents,
      systemStatus,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    res.status(500).json({ message: 'Error fetching real-time analytics' });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get trend analytics for charts
// @access  Private
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Ticket creation trends
    const creationTrends = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
      }
    ]);

    // Resolution trends
    const resolutionTrends = await Ticket.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$resolvedAt' },
            month: { $month: '$resolvedAt' },
            day: { $dayOfMonth: '$resolvedAt' },
            hour: { $hour: '$resolvedAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
      }
    ]);

    // Category trends
    const categoryTrends = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
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
        $sort: { count: -1 }
      }
    ]);

    // Priority trends
    const priorityTrends = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      creationTrends,
      resolutionTrends,
      categoryTrends,
      priorityTrends,
      period,
      startDate,
      endDate: now
    });
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    res.status(500).json({ message: 'Error fetching trend analytics' });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private (Admin/Agent only)
router.get('/export', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { format = 'csv', range = '30', startDate, endDate } = req.query;
    
    // Calculate date range
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date(end.getTime() - parseInt(range) * 24 * 60 * 60 * 1000);
    }
    
    // Get analytics data
    const ticketStats = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 }
              }
            }
          ],
          byCategory: [
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
                _id: '$categoryInfo.name',
                count: { $sum: 1 }
              }
            }
          ],
          dailyStats: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id': 1 } }
          ]
        }
      }
    ]);
    
    // Get user activity
    const userActivity = await User.aggregate([
      {
        $match: {
          lastActiveAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [
                { $gte: ['$lastActiveAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const analyticsData = {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      ticketStats: ticketStats[0] || {},
      userActivity: userActivity,
      exportDate: new Date().toISOString()
    };
    
    if (format === 'csv') {
      // Create CSV content
      const csvRows = [
        ['Analytics Report'],
        ['Period Start', 'Period End', 'Export Date'],
        [start.toISOString(), end.toISOString(), new Date().toISOString()],
        [],
        ['Ticket Statistics'],
        ['Metric', 'Value']
      ];
      
      // Add ticket stats
      if (ticketStats[0]?.total?.[0]?.count) {
        csvRows.push(['Total Tickets', ticketStats[0].total[0].count]);
      }
      
      // Add status breakdown
      if (ticketStats[0]?.byStatus) {
        csvRows.push([]);
        csvRows.push(['Status Breakdown']);
        csvRows.push(['Status', 'Count']);
        ticketStats[0].byStatus.forEach(stat => {
          csvRows.push([stat._id, stat.count]);
        });
      }
      
      // Add priority breakdown
      if (ticketStats[0]?.byPriority) {
        csvRows.push([]);
        csvRows.push(['Priority Breakdown']);
        csvRows.push(['Priority', 'Count']);
        ticketStats[0].byPriority.forEach(stat => {
          csvRows.push([stat._id, stat.count]);
        });
      }
      
      // Add daily stats
      if (ticketStats[0]?.dailyStats) {
        csvRows.push([]);
        csvRows.push(['Daily Statistics']);
        csvRows.push(['Date', 'Tickets Created']);
        ticketStats[0].dailyStats.forEach(stat => {
          csvRows.push([stat._id, stat.count]);
        });
      }
      
      // Add user activity
      if (userActivity.length > 0) {
        csvRows.push([]);
        csvRows.push(['User Activity']);
        csvRows.push(['Role', 'Total Users', 'Active Users']);
        userActivity.forEach(stat => {
          csvRows.push([stat._id, stat.count, stat.activeUsers]);
        });
      }
      
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: analyticsData
      });
    }
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ message: 'Error exporting analytics data' });
  }
});

module.exports = router; 