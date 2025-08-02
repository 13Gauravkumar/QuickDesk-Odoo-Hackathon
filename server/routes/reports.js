const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Report = require('../models/Report');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Get all reports
router.get('/', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { page = 1, limit = 10, type, isActive } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const reports = await Report.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Report.countDocuments(query);
    
    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single report
router.get('/:id', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('allowedUsers', 'name email');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json({ report });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create report
router.post('/', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      dataSource,
      filters,
      dateRange,
      columns,
      sortBy,
      limit,
      chartType,
      chartConfig,
      schedule,
      isPublic,
      allowedRoles,
      allowedUsers,
      cacheEnabled,
      cacheExpiry,
      exportFormats,
      exportSettings
    } = req.body;
    
    const report = new Report({
      name,
      description,
      type,
      dataSource,
      filters,
      dateRange,
      columns,
      sortBy,
      limit,
      chartType,
      chartConfig,
      schedule,
      isPublic,
      allowedRoles,
      allowedUsers,
      cacheEnabled,
      cacheExpiry,
      exportFormats,
      exportSettings,
      createdBy: req.user.id
    });
    
    await report.save();
    
    res.status(201).json({ report });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update report
router.put('/:id', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json({ report });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete report
router.delete('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate report data
router.post('/:id/generate', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const data = await report.generateData();
    
    res.json({ data, report });
  } catch (error) {
    console.error('Error generating report data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export report
router.get('/:id/export', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    const exportedData = await report.export(format);
    
    // Set appropriate headers for download
    const filename = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(exportedData);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get report templates
router.get('/templates', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const templates = [
      {
        name: 'Ticket Analytics',
        description: 'Comprehensive analysis of ticket metrics',
        type: 'ticket_analytics',
        dataSource: 'tickets',
        columns: [
          { field: 'subject', displayName: 'Subject', type: 'text' },
          { field: 'status', displayName: 'Status', type: 'text' },
          { field: 'priority', displayName: 'Priority', type: 'text' },
          { field: 'categoryName', displayName: 'Category', type: 'text' },
          { field: 'creatorName', displayName: 'Created By', type: 'text' },
          { field: 'assigneeName', displayName: 'Assigned To', type: 'text' },
          { field: 'createdAt', displayName: 'Created Date', type: 'date' },
          { field: 'resolutionTime', displayName: 'Resolution Time', type: 'number' }
        ],
        chartType: 'bar',
        chartConfig: {
          xAxis: 'status',
          yAxis: 'count',
          series: ['tickets']
        }
      },
      {
        name: 'Agent Performance',
        description: 'Performance metrics for support agents',
        type: 'agent_performance',
        dataSource: 'tickets',
        columns: [
          { field: 'agentName', displayName: 'Agent Name', type: 'text' },
          { field: 'totalTickets', displayName: 'Total Tickets', type: 'number' },
          { field: 'resolvedTickets', displayName: 'Resolved Tickets', type: 'number' },
          { field: 'resolutionRate', displayName: 'Resolution Rate', type: 'percentage' },
          { field: 'avgResolutionTime', displayName: 'Avg Resolution Time', type: 'number' },
          { field: 'avgSatisfaction', displayName: 'Avg Satisfaction', type: 'number' }
        ],
        chartType: 'bar',
        chartConfig: {
          xAxis: 'agentName',
          yAxis: 'resolutionRate',
          series: ['resolutionRate']
        }
      },
      {
        name: 'SLA Compliance',
        description: 'Service Level Agreement compliance metrics',
        type: 'sla_compliance',
        dataSource: 'tickets',
        columns: [
          { field: 'totalTickets', displayName: 'Total Tickets', type: 'number' },
          { field: 'responseCompliant', displayName: 'Response Compliant', type: 'number' },
          { field: 'resolutionCompliant', displayName: 'Resolution Compliant', type: 'number' },
          { field: 'responseComplianceRate', displayName: 'Response Compliance Rate', type: 'percentage' },
          { field: 'resolutionComplianceRate', displayName: 'Resolution Compliance Rate', type: 'percentage' },
          { field: 'avgResponseTime', displayName: 'Avg Response Time', type: 'number' },
          { field: 'avgResolutionTime', displayName: 'Avg Resolution Time', type: 'number' }
        ],
        chartType: 'pie',
        chartConfig: {
          xAxis: 'compliance',
          yAxis: 'percentage',
          series: ['responseComplianceRate', 'resolutionComplianceRate']
        }
      }
    ];
    
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching report templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard widgets
router.get('/widgets', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    // Ticket statistics
    const ticketStats = await Ticket.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          openTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          inProgressTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
          },
          resolvedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          closedTickets: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Priority distribution
    const priorityStats = await Ticket.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Category distribution
    const categoryStats = await Ticket.aggregate([
      { $match: dateFilter },
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
          _id: { $arrayElemAt: ['$categoryInfo.name', 0] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Daily ticket trends
    const dailyTrends = await Ticket.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Agent performance
    const agentPerformance = await Ticket.aggregate([
      { $match: { ...dateFilter, assignedTo: { $exists: true } } },
      {
        $group: {
          _id: '$assignedTo',
          totalTickets: { $sum: 1 },
          resolvedTickets: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] }
          },
          avgResolutionTime: {
            $avg: {
              $cond: {
                if: { $in: ['$status', ['resolved', 'closed']] },
                then: { $subtract: ['$resolvedAt', '$createdAt'] },
                else: null
              }
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
        $addFields: {
          agentName: { $arrayElemAt: ['$agentInfo.name', 0] },
          resolutionRate: {
            $multiply: [
              { $divide: ['$resolvedTickets', '$totalTickets'] },
              100
            ]
          }
        }
      },
      { $sort: { resolutionRate: -1 } },
      { $limit: 5 }
    ]);
    
    const widgets = {
      ticketStats: ticketStats[0] || {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0
      },
      priorityStats,
      categoryStats,
      dailyTrends,
      agentPerformance
    };
    
    res.json({ widgets });
  } catch (error) {
    console.error('Error fetching dashboard widgets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get real-time metrics
router.get('/metrics/realtime', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Tickets created in last hour
    const ticketsLastHour = await Ticket.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });
    
    // Tickets created in last day
    const ticketsLastDay = await Ticket.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });
    
    // Active conversations
    const activeConversations = await require('../models/Chatbot').countDocuments({
      status: { $in: ['active', 'waiting_for_agent'] }
    });
    
    // Average response time (last 24 hours)
    const avgResponseTime = await Ticket.aggregate([
      {
        $match: {
          firstResponseAt: { $gte: oneDayAgo },
          firstResponseAt: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: {
            $avg: { $subtract: ['$firstResponseAt', '$createdAt'] }
          }
        }
      }
    ]);
    
    // SLA compliance rate (last 24 hours)
    const slaCompliance = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: oneDayAgo },
          firstResponseAt: { $exists: true }
        }
      },
      {
        $addFields: {
          responseSLA: {
            $cond: {
              if: { $lte: [{ $subtract: ['$firstResponseAt', '$createdAt'] }, 4 * 60 * 60 * 1000] },
              then: 1,
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          compliantTickets: { $sum: '$responseSLA' }
        }
      }
    ]);
    
    const metrics = {
      ticketsLastHour,
      ticketsLastDay,
      activeConversations,
      avgResponseTime: avgResponseTime[0]?.avgResponseTime || 0,
      slaComplianceRate: slaCompliance[0] ? 
        (slaCompliance[0].compliantTickets / slaCompliance[0].totalTickets) * 100 : 0,
      timestamp: now
    };
    
    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Schedule report execution
router.post('/:id/schedule', authenticateToken, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { schedule } = req.body;
    
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    report.schedule = schedule;
    await report.save();
    
    res.json({ report });
  } catch (error) {
    console.error('Error scheduling report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk operations on reports
router.post('/bulk', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { operation, reportIds } = req.body;
    
    if (!operation || !reportIds || !Array.isArray(reportIds)) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }
    
    let updateData = {};
    
    switch (operation) {
      case 'activate':
        updateData.isActive = true;
        break;
      case 'deactivate':
        updateData.isActive = false;
        break;
      case 'delete':
        await Report.deleteMany({ _id: { $in: reportIds } });
        return res.json({ message: `${reportIds.length} reports deleted successfully` });
      default:
        return res.status(400).json({ message: 'Invalid operation' });
    }
    
    const result = await Report.updateMany(
      { _id: { $in: reportIds } },
      updateData
    );
    
    res.json({
      message: `${result.modifiedCount} reports updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 