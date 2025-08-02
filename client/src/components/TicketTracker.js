import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  UserCheck,
  UserX,
  MessageSquare,
  Edit,
  Eye,
  Plus,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Target,
  Award,
  Calendar,
  Users,
  Shield,
  Brain,
  Workflow,
  Cog,
  BarChart3,
  Kanban,
  MoreHorizontal,
  Star,
  Priority,
  Tag,
  FileText,
  Link,
  ExternalLink,
  RefreshCw,
  Play,
  Pause,
  StopCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TicketTracker = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [realTimeTickets, setRealTimeTickets] = useState([]);
  const [ticketStats, setTicketStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    overdue: 0
  });
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [filter, setFilter] = useState('all');

  // Real-time ticket updates
  useEffect(() => {
    if (socket && socket.on) {
      // Ticket creation
      socket.on('ticket:created', (data) => {
        setRealTimeTickets(prev => [data.ticket, ...prev]);
        setTicketStats(prev => ({
          ...prev,
          total: prev.total + 1,
          open: prev.open + 1,
          urgent: data.ticket.priority === 'urgent' ? prev.urgent + 1 : prev.urgent
        }));
        addLiveUpdate('ticket_created', data.ticket);
        toast.success(`New ticket created: ${data.ticket.subject}`);
      });

      // Ticket updates
      socket.on('ticket:updated', (data) => {
        setRealTimeTickets(prev => 
          prev.map(ticket => 
            ticket._id === data.ticket._id ? data.ticket : ticket
          )
        );
        addLiveUpdate('ticket_updated', data.ticket);
        toast(`Ticket updated: ${data.ticket.subject}`);
      });

      // Ticket resolution
      socket.on('ticket:resolved', (data) => {
        setRealTimeTickets(prev => 
          prev.map(ticket => 
            ticket._id === data.ticket._id ? data.ticket : ticket
          )
        );
        setTicketStats(prev => ({
          ...prev,
          resolved: prev.resolved + 1,
          open: Math.max(0, prev.open - 1),
          inProgress: data.ticket.status === 'in-progress' ? Math.max(0, prev.inProgress - 1) : prev.inProgress
        }));
        addLiveUpdate('ticket_resolved', data.ticket);
        toast.success(`Ticket resolved: ${data.ticket.subject}`);
      });

      // Ticket assignment
      socket.on('ticket:assigned', (data) => {
        setRealTimeTickets(prev => 
          prev.map(ticket => 
            ticket._id === data.ticket._id ? data.ticket : ticket
          )
        );
        addLiveUpdate('ticket_assigned', data.ticket);
        toast.success(`Ticket assigned: ${data.ticket.subject}`);
      });

      // New comments
      socket.on('ticket:commentAdded', (data) => {
        addLiveUpdate('comment_added', data.ticket);
        toast(`New comment on ticket: ${data.ticket.subject}`);
      });

      // Ticket deletion
      socket.on('ticket:deleted', (data) => {
        setRealTimeTickets(prev => 
          prev.filter(ticket => ticket._id !== data.ticketId)
        );
        setTicketStats(prev => ({
          ...prev,
          total: Math.max(0, prev.total - 1)
        }));
        addLiveUpdate('ticket_deleted', { ticketId: data.ticketId });
        toast('Ticket deleted');
      });

      return () => {
        if (socket && socket.off) {
          socket.off('ticket:created');
          socket.off('ticket:updated');
          socket.off('ticket:resolved');
          socket.off('ticket:assigned');
          socket.off('ticket:commentAdded');
          socket.off('ticket:deleted');
        }
      };
    }
  }, [socket]);

  const addLiveUpdate = (type, data) => {
    const update = {
      id: Date.now(),
      type,
      data,
      timestamp: new Date(),
      user: user?.name || 'System'
    };
    setLiveUpdates(prev => [update, ...prev.slice(0, 19)]);
  };

  // Fetch tickets based on user role
  const { data: tickets, isLoading } = useQuery(['tickets', filter], async () => {
    let url = '/api/tickets';
    const params = new URLSearchParams();
    
    if (user?.role === 'user') {
      params.append('myTickets', 'true');
    } else if (user?.role === 'agent') {
      params.append('assignedTo', 'me');
    }
    
    if (filter !== 'all') {
      params.append('status', filter);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // Fetch ticket statistics
  const { data: stats } = useQuery('ticket-stats', async () => {
    const response = await fetch('/api/tickets/stats', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // Combine real-time and fetched data
  const allTickets = [...realTimeTickets, ...(tickets?.tickets || [])];
  const combinedStats = { ...stats, ...ticketStats };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'in-progress':
        return <Activity className="w-4 h-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'closed':
        return <StopCircle className="w-4 h-4 text-gray-600" />;
      default:
        return <Ticket className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleSpecificActions = () => {
    const actions = [
      {
        title: 'Create Ticket',
        description: 'Submit a new support request',
        icon: Plus,
        link: '/tickets/create',
        color: 'bg-blue-500 hover:bg-blue-600',
        role: 'all'
      },
      {
        title: 'View All Tickets',
        description: 'Browse and manage tickets',
        icon: Ticket,
        link: '/tickets',
        color: 'bg-green-500 hover:bg-green-600',
        role: 'all'
      }
    ];

    if (user?.role === 'agent' || user?.role === 'admin') {
      actions.push(
        {
          title: 'My Assigned Tickets',
          description: 'View tickets assigned to you',
          icon: UserCheck,
          link: '/tickets?assignedTo=me',
          color: 'bg-purple-500 hover:bg-purple-600',
          role: 'agent'
        },
        {
          title: 'Unassigned Tickets',
          description: 'View tickets needing assignment',
          icon: UserX,
          link: '/tickets?unassigned=true',
          color: 'bg-orange-500 hover:bg-orange-600',
          role: 'agent'
        }
      );
    }

    if (user?.role === 'admin') {
      actions.push(
        {
          title: 'Ticket Analytics',
          description: 'View detailed ticket analytics',
          icon: BarChart3,
          link: '/analytics',
          color: 'bg-indigo-500 hover:bg-indigo-600',
          role: 'admin'
        },
        {
          title: 'Workflow Management',
          description: 'Configure ticket workflows',
          icon: Workflow,
          link: '/admin/workflow',
          color: 'bg-teal-500 hover:bg-teal-600',
          role: 'admin'
        }
      );
    }

    return actions.filter(action => 
      action.role === 'all' || action.role === user?.role
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{combinedStats?.totalTickets || 0}</p>
            </div>
            <div className="p-2 bg-blue-500 rounded-lg">
              <Ticket className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-center space-x-1 mt-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-gray-500">+12% from last month</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Open Tickets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{combinedStats?.openTickets || 0}</p>
            </div>
            <div className="p-2 bg-orange-500 rounded-lg">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-center space-x-1 mt-2">
            <Activity className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-gray-500">5 new today</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{combinedStats?.inProgressTickets || 0}</p>
            </div>
            <div className="p-2 bg-yellow-500 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-center space-x-1 mt-2">
            <Activity className="w-3 h-3 text-yellow-500" />
            <span className="text-xs text-gray-500">3 being worked on</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{combinedStats?.resolvedTickets || 0}</p>
            </div>
            <div className="p-2 bg-green-500 rounded-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex items-center space-x-1 mt-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-xs text-gray-500">+8 this week</span>
          </div>
        </div>
      </div>

      {/* Role-specific Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 capitalize">Role: {user?.role}</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getRoleSpecificActions().map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className={`${action.color} text-white rounded-lg p-4 transition-colors hover:shadow-md`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <div>
                    <h4 className="font-medium">{action.title}</h4>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Real-time Ticket List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Ticket Updates</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Real-time</span>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : allTickets.length > 0 ? (
          <div className="space-y-3">
            {allTickets.slice(0, 10).map((ticket) => (
              <div key={ticket._id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center space-x-2">
                    {getPriorityIcon(ticket.priority)}
                    {getStatusIcon(ticket.status)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">{ticket.subject}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{ticket.description}</p>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
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
                      <span className={`px-2 py-1 rounded-full ${
                        ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                        ticket.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/tickets/${ticket._id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                  >
                    <Eye className="w-4 h-4" />
                    <span>View</span>
                  </Link>
                  {(user?.role === 'agent' || user?.role === 'admin') && (
                    <Link
                      to={`/tickets/${ticket._id}/edit`}
                      className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tickets found</p>
          </div>
        )}
      </div>

      {/* Live Updates Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Updates</h3>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Real-time</span>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {liveUpdates.length > 0 ? (
            liveUpdates.map((update, index) => (
              <div key={update.id} className="flex items-start space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">{update.user}</span> {update.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(update.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No recent updates</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketTracker; 