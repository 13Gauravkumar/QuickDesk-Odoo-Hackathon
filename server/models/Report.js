const mongoose = require('mongoose');

const reportFilterSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  operator: {
    type: String,
    enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'between', 'in', 'not_in'],
    required: true
  },
  value: mongoose.Schema.Types.Mixed,
  value2: mongoose.Schema.Types.Mixed // for between operator
});

const reportColumnSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'boolean', 'currency', 'percentage'],
    default: 'text'
  },
  sortable: {
    type: Boolean,
    default: true
  },
  filterable: {
    type: Boolean,
    default: true
  },
  aggregate: {
    type: String,
    enum: ['sum', 'avg', 'count', 'min', 'max', 'none'],
    default: 'none'
  },
  format: {
    type: String,
    default: null
  }
});

const reportScheduleSchema = new mongoose.Schema({
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    default: 1 // Monday
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
    default: 1
  },
  time: {
    type: String,
    default: '09:00'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastRun: Date,
  nextRun: Date
});

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['ticket_analytics', 'agent_performance', 'sla_compliance', 'customer_satisfaction', 'workload_distribution', 'trend_analysis', 'custom'],
    required: true
  },
  // Data source and filters
  dataSource: {
    type: String,
    enum: ['tickets', 'users', 'categories', 'conversations', 'automations'],
    required: true
  },
  filters: [reportFilterSchema],
  dateRange: {
    type: {
      type: String,
      enum: ['relative', 'absolute', 'custom'],
      default: 'relative'
    },
    relative: {
      type: String,
      enum: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month', 'this_year', 'last_year'],
      default: 'last_30_days'
    },
    startDate: Date,
    endDate: Date
  },
  // Columns and display
  columns: [reportColumnSchema],
  sortBy: {
    field: String,
    direction: {
      type: String,
      enum: ['asc', 'desc'],
      default: 'desc'
    }
  },
  limit: {
    type: Number,
    default: 100
  },
  // Visualization
  chartType: {
    type: String,
    enum: ['table', 'bar', 'line', 'pie', 'doughnut', 'area', 'scatter', 'heatmap'],
    default: 'table'
  },
  chartConfig: {
    xAxis: String,
    yAxis: String,
    series: [String],
    colors: [String],
    options: mongoose.Schema.Types.Mixed
  },
  // Scheduling
  schedule: reportScheduleSchema,
  // Access control
  isPublic: {
    type: Boolean,
    default: false
  },
  allowedRoles: [{
    type: String,
    enum: ['user', 'agent', 'admin', 'supervisor']
  }],
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Caching
  cacheEnabled: {
    type: Boolean,
    default: true
  },
  cacheExpiry: {
    type: Number, // in minutes
    default: 60
  },
  lastCached: Date,
  cachedData: mongoose.Schema.Types.Mixed,
  // Export settings
  exportFormats: [{
    type: String,
    enum: ['csv', 'pdf', 'excel', 'json']
  }],
  exportSettings: {
    includeCharts: {
      type: Boolean,
      default: true
    },
    includeFilters: {
      type: Boolean,
      default: true
    },
    pageSize: {
      type: String,
      enum: ['A4', 'Letter', 'Legal'],
      default: 'A4'
    },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
reportSchema.index({ type: 1, isActive: 1 });
reportSchema.index({ createdBy: 1 });
reportSchema.index({ 'schedule.nextRun': 1 });
reportSchema.index({ allowedRoles: 1 });

// Virtual for report URL
reportSchema.virtual('reportUrl').get(function() {
  return `/reports/${this._id}`;
});

// Virtual for export URL
reportSchema.virtual('exportUrl').get(function() {
  return `/api/reports/${this._id}/export`;
});

// Method to generate report data
reportSchema.methods.generateData = async function() {
  const Ticket = require('./Ticket');
  const User = require('./User');
  const Category = require('./Category');
  
  let query = {};
  let aggregation = [];
  
  // Apply date filters
  if (this.dateRange.type === 'relative') {
    const dateFilter = this.getRelativeDateFilter(this.dateRange.relative);
    query.createdAt = dateFilter;
  } else if (this.dateRange.type === 'absolute') {
    query.createdAt = {
      $gte: this.dateRange.startDate,
      $lte: this.dateRange.endDate
    };
  }
  
  // Apply custom filters
  this.filters.forEach(filter => {
    query[filter.field] = this.buildFilterQuery(filter);
  });
  
  // Build aggregation pipeline based on report type
  switch (this.type) {
    case 'ticket_analytics':
      aggregation = this.buildTicketAnalyticsPipeline(query);
      break;
    case 'agent_performance':
      aggregation = this.buildAgentPerformancePipeline(query);
      break;
    case 'sla_compliance':
      aggregation = this.buildSLACompliancePipeline(query);
      break;
    case 'customer_satisfaction':
      aggregation = this.buildCustomerSatisfactionPipeline(query);
      break;
    case 'workload_distribution':
      aggregation = this.buildWorkloadDistributionPipeline(query);
      break;
    case 'trend_analysis':
      aggregation = this.buildTrendAnalysisPipeline(query);
      break;
    default:
      aggregation = [{ $match: query }];
  }
  
  // Apply sorting and limit
  if (this.sortBy.field) {
    aggregation.push({ $sort: { [this.sortBy.field]: this.sortBy.direction === 'asc' ? 1 : -1 } });
  }
  
  if (this.limit) {
    aggregation.push({ $limit: this.limit });
  }
  
  // Execute aggregation
  const data = await Ticket.aggregate(aggregation);
  
  // Cache the result
  if (this.cacheEnabled) {
    this.cachedData = data;
    this.lastCached = new Date();
    await this.save();
  }
  
  return data;
};

// Method to build relative date filter
reportSchema.methods.getRelativeDateFilter = function(relative) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (relative) {
    case 'today':
      return {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      };
    case 'yesterday':
      const yesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);
      return {
        $gte: yesterday,
        $lt: startOfDay
      };
    case 'last_7_days':
      return {
        $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      };
    case 'last_30_days':
      return {
        $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      };
    case 'last_90_days':
      return {
        $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      };
    case 'this_month':
      return {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1)
      };
    case 'last_month':
      return {
        $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        $lt: new Date(now.getFullYear(), now.getMonth(), 1)
      };
    case 'this_year':
      return {
        $gte: new Date(now.getFullYear(), 0, 1)
      };
    case 'last_year':
      return {
        $gte: new Date(now.getFullYear() - 1, 0, 1),
        $lt: new Date(now.getFullYear(), 0, 1)
      };
    default:
      return {};
  }
};

// Method to build filter query
reportSchema.methods.buildFilterQuery = function(filter) {
  switch (filter.operator) {
    case 'equals':
      return filter.value;
    case 'not_equals':
      return { $ne: filter.value };
    case 'contains':
      return { $regex: filter.value, $options: 'i' };
    case 'not_contains':
      return { $not: { $regex: filter.value, $options: 'i' } };
    case 'greater_than':
      return { $gt: filter.value };
    case 'less_than':
      return { $lt: filter.value };
    case 'between':
      return { $gte: filter.value, $lte: filter.value2 };
    case 'in':
      return { $in: Array.isArray(filter.value) ? filter.value : [filter.value] };
    case 'not_in':
      return { $nin: Array.isArray(filter.value) ? filter.value : [filter.value] };
    default:
      return filter.value;
  }
};

// Method to build ticket analytics pipeline
reportSchema.methods.buildTicketAnalyticsPipeline = function(query) {
  return [
    { $match: query },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'creatorInfo'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        as: 'assigneeInfo'
      }
    },
    {
      $addFields: {
        categoryName: { $arrayElemAt: ['$categoryInfo.name', 0] },
        creatorName: { $arrayElemAt: ['$creatorInfo.name', 0] },
        assigneeName: { $arrayElemAt: ['$assigneeInfo.name', 0] },
        resolutionTime: {
          $cond: {
            if: { $in: ['$status', ['resolved', 'closed']] },
            then: { $subtract: ['$resolvedAt', '$createdAt'] },
            else: null
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        subject: 1,
        status: 1,
        priority: 1,
        categoryName: 1,
        creatorName: 1,
        assigneeName: 1,
        createdAt: 1,
        resolvedAt: 1,
        resolutionTime: 1,
        totalTimeSpent: 1,
        satisfaction: 1
      }
    }
  ];
};

// Method to build agent performance pipeline
reportSchema.methods.buildAgentPerformancePipeline = function(query) {
  return [
    { $match: { ...query, assignedTo: { $exists: true } } },
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
        },
        avgSatisfaction: {
          $avg: '$satisfaction.rating'
        },
        totalTimeSpent: { $sum: '$totalTimeSpent' }
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
        agentEmail: { $arrayElemAt: ['$agentInfo.email', 0] }
      }
    },
    {
      $project: {
        _id: 1,
        agentName: 1,
        agentEmail: 1,
        totalTickets: 1,
        resolvedTickets: 1,
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolvedTickets', '$totalTickets'] },
            100
          ]
        },
        avgResolutionTime: 1,
        avgSatisfaction: 1,
        totalTimeSpent: 1
      }
    }
  ];
};

// Method to build SLA compliance pipeline
reportSchema.methods.buildSLACompliancePipeline = function(query) {
  return [
    { $match: query },
    {
      $addFields: {
        responseTime: {
          $subtract: ['$firstResponseAt', '$createdAt']
        },
        resolutionTime: {
          $subtract: ['$resolvedAt', '$createdAt']
        },
        responseSLA: {
          $cond: {
            if: { $lte: [{ $subtract: ['$firstResponseAt', '$createdAt'] }, 4 * 60 * 60 * 1000] },
            then: 'compliant',
            else: 'breached'
          }
        },
        resolutionSLA: {
          $cond: {
            if: { $lte: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 72 * 60 * 60 * 1000] },
            then: 'compliant',
            else: 'breached'
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalTickets: { $sum: 1 },
        responseCompliant: {
          $sum: { $cond: [{ $eq: ['$responseSLA', 'compliant'] }, 1, 0] }
        },
        resolutionCompliant: {
          $sum: { $cond: [{ $eq: ['$resolutionSLA', 'compliant'] }, 1, 0] }
        },
        avgResponseTime: { $avg: '$responseTime' },
        avgResolutionTime: { $avg: '$resolutionTime' }
      }
    },
    {
      $addFields: {
        responseComplianceRate: {
          $multiply: [
            { $divide: ['$responseCompliant', '$totalTickets'] },
            100
          ]
        },
        resolutionComplianceRate: {
          $multiply: [
            { $divide: ['$resolutionCompliant', '$totalTickets'] },
            100
          ]
        }
      }
    }
  ];
};

// Method to export report
reportSchema.methods.export = async function(format = 'csv') {
  const data = await this.generateData();
  
  switch (format) {
    case 'csv':
      return this.exportToCSV(data);
    case 'pdf':
      return this.exportToPDF(data);
    case 'excel':
      return this.exportToExcel(data);
    case 'json':
      return JSON.stringify(data, null, 2);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
};

// Method to export to CSV
reportSchema.methods.exportToCSV = function(data) {
  if (!data || data.length === 0) return '';
  
  const headers = this.columns.map(col => col.displayName || col.field);
  const rows = data.map(row => {
    return this.columns.map(col => {
      const value = row[col.field];
      if (col.type === 'date' && value) {
        return new Date(value).toLocaleDateString();
      }
      if (col.type === 'currency' && value) {
        return `$${parseFloat(value).toFixed(2)}`;
      }
      if (col.type === 'percentage' && value) {
        return `${parseFloat(value).toFixed(1)}%`;
      }
      return value || '';
    });
  });
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csvContent;
};

// Method to export to PDF
reportSchema.methods.exportToPDF = function(data) {
  // This would integrate with a PDF library like puppeteer or jsPDF
  return {
    message: 'PDF export functionality would be implemented here',
    data: data
  };
};

// Method to export to Excel
reportSchema.methods.exportToExcel = function(data) {
  // This would integrate with a library like exceljs
  return {
    message: 'Excel export functionality would be implemented here',
    data: data
  };
};

module.exports = mongoose.model('Report', reportSchema); 