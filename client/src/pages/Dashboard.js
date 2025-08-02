import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Brain,
  Workflow,
  Cog,
  Bell,
  Star,
  Activity,
  BarChart3,
  Kanban,
  MoreHorizontal,
  Users,
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [realTimeStats, setRealTimeStats] = useState({});
  const [notifications, setNotifications] = useState([]);

  // Real-time updates
  useEffect(() => {
    if (socket && socket.on) {
      // Ticket events
      socket.on('ticket:created', (data) => {
        toast.success(`New ticket created: ${data.ticket.subject}`);
        setRealTimeStats(prev => ({
          ...prev,
          totalTickets: (prev.totalTickets || 0) + 1,
          openTickets: (prev.openTickets || 0) + 1
        }));
      });

      socket.on('ticket:updated', (data) => {
        toast.info(`Ticket updated: ${data.ticket.subject}`);
      });

      socket.on('ticket:resolved', (data) => {
        toast.success(`Ticket resolved: ${data.ticket.subject}`);
        setRealTimeStats(prev => ({
          ...prev,
          resolvedTickets: (prev.resolvedTickets || 0) + 1,
          openTickets: Math.max(0, (prev.openTickets || 0) - 1)
        }));
      });

      socket.on('ticket:deleted', (data) => {
        toast.info(`Ticket deleted`);
        setRealTimeStats(prev => ({
          ...prev,
          totalTickets: Math.max(0, (prev.totalTickets || 0) - 1)
        }));
      });

      socket.on('ticket:assigned', (data) => {
        toast.success(`Ticket assigned: ${data.ticket.subject}`);
      });

      socket.on('ticket:commentAdded', (data) => {
        toast.info(`New comment on ticket: ${data.ticket.subject}`);
      });

      // Dashboard stats updates
      socket.on('dashboard:stats:updated', (data) => {
        setRealTimeStats(prev => ({
          ...prev,
          lastUpdate: new Date()
        }));
      });

      // Knowledge base events
      socket.on('knowledge:article_viewed', (data) => {
        console.log(`Article viewed: ${data.title}`);
      });

      socket.on('knowledge:article_rated', (data) => {
        toast.success(`Article rated: ${data.title}`);
      });

      // Notifications
      socket.on('notification:new', (notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 9)]);
        toast(notification.message, {
          icon: notification.type === 'urgent' ? '🔴' : '🔵'
        });
      });

      return () => {
        if (socket && socket.off) {
          socket.off('ticket:created');
          socket.off('ticket:updated');
          socket.off('ticket:resolved');
          socket.off('ticket:deleted');
          socket.off('ticket:assigned');
          socket.off('ticket:commentAdded');
          socket.off('dashboard:stats:updated');
          socket.off('knowledge:article_viewed');
          socket.off('knowledge:article_rated');
          socket.off('notification:new');
        }
      };
    }
  }, [socket]);

  const { data: stats, isLoading: statsLoading } = useQuery('dashboard-stats', async () => {
    const response = await fetch('/api/tickets/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  const { data: recentTickets, isLoading: ticketsLoading } = useQuery('recent-tickets', async () => {
    const response = await fetch('/api/tickets?limit=5&sort=-createdAt', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // AI Recommendations
  const { data: recommendations } = useQuery('ai-recommendations', async () => {
    const response = await fetch('/api/dashboard/recommendations', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // Workflow Analytics
  const { data: workflowData } = useQuery('workflow-analytics', async () => {
    const response = await fetch('/api/tickets/workflow', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // Performance Metrics
  const { data: performanceData } = useQuery('performance-metrics', async () => {
    const response = await fetch('/api/analytics/performance', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // Combine real-time and cached stats
  const combinedStats = {
    ...stats,
    ...realTimeStats
  };

  const statsCards = [
    {
      title: 'Total Tickets',
      value: combinedStats?.totalTickets || 0,
      icon: Ticket,
      color: 'bg-blue-500',
      change: '+12% from last month',
      trend: 'up'
    },
    {
      title: 'Open Tickets',
      value: combinedStats?.openTickets || 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      change: '5 new today',
      trend: 'up'
    },
    {
      title: 'In Progress',
      value: combinedStats?.inProgressTickets || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      change: '3 being worked on',
      trend: 'stable'
    },
    {
      title: 'Resolved',
      value: combinedStats?.resolvedTickets || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: '+8 this week',
      trend: 'up'
    }
  ];

  const quickActions = [
    {
      title: 'Create New Ticket',
      description: 'Submit a new support request',
      icon: Plus,
      link: '/tickets/create',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'View All Tickets',
      description: 'Browse and manage tickets',
      icon: Ticket,
      link: '/tickets',
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Teams',
      description: 'Manage teams and collaborate',
      icon: Users,
      link: '/teams',
      color: 'bg-teal-500 hover:bg-teal-600'
    },
    {
      title: 'Knowledge Base',
      description: 'Browse helpful articles',
      icon: Brain,
      link: '/knowledge-base',
      color: 'bg-indigo-500 hover:bg-indigo-600'
    }
  ];

  if (user?.role === 'admin') {
    quickActions.push(
      {
        title: 'Manage Categories',
        description: 'Create and edit ticket categories',
        icon: Filter,
        link: '/admin/categories',
        color: 'bg-indigo-500 hover:bg-indigo-600'
      },
      {
        title: 'Analytics',
        description: 'View detailed analytics and reports',
        icon: BarChart3,
        link: '/analytics',
        color: 'bg-purple-500 hover:bg-purple-600'
      },
      {
        title: 'Workflow Automation',
        description: 'Configure automated workflows',
        icon: Cog,
        link: '/admin/workflow',
        color: 'bg-orange-500 hover:bg-orange-600'
      }
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Jira-style Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Live</span>
              </div>
            </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-gray-600 hover:text-gray-800 cursor-pointer" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900">{user?.name}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    {getTrendIcon(card.trend)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">{card.change}</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={index}
                    to={action.link}
                    className={`${action.color} text-white rounded-lg p-4 transition-colors`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <h3 className="font-medium">{action.title}</h3>
                        <p className="text-sm opacity-90">{action.description}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Tickets */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Tickets</h2>
              <Link to="/tickets" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                View All
              </Link>
            </div>
            
            {ticketsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : recentTickets?.tickets?.length > 0 ? (
              <div className="space-y-4">
                {recentTickets.tickets.map((ticket) => (
                  <div key={ticket._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
                      <p className="text-sm text-gray-600">{ticket.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>#{ticket._id.slice(-6)}</span>
                        <span>{formatDate(ticket.createdAt)}</span>
                        <span className={`px-2 py-1 rounded-full ${
                          ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/tickets/${ticket._id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No recent tickets</p>
              </div>
            )}
          </div>

          {/* AI Recommendations */}
          {recommendations?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">AI Recommendations</h2>
              </div>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                    <Star className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                      <p className="text-xs text-gray-600">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Workflow Alerts */}
          {workflowData?.suggestions?.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Workflow className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Workflow Alerts</h3>
              </div>
              <div className="space-y-3">
                {workflowData.suggestions.map((alert, index) => (
                  <div key={index} className={`p-3 rounded-lg ${
                    alert.type === 'warning' ? 'bg-red-50 border border-red-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                    <button className="text-xs text-blue-600 hover:text-blue-700 mt-1">
                      Take Action
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {performanceData && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Response Time</span>
                  <span className="text-sm font-medium">{performanceData.avgResponseTime || '2.5h'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Resolution Rate</span>
                  <span className="text-sm font-medium">{performanceData.resolutionRate || '85%'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">SLA Compliance</span>
                  <span className="text-sm font-medium">{performanceData.slaCompliance || '92%'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Notifications */}
          {notifications.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h3>
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notification, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      notification.type === 'urgent' ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500">{formatDate(notification.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Real-time Updates</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Services</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600">Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Dashboard; 