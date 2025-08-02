import React from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { 
  Ticket, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus,
  Search,
  Filter,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();

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

  const statsCards = [
    {
      title: 'Total Tickets',
      value: stats?.totalTickets || 0,
      icon: Ticket,
      color: 'bg-blue-500',
      change: '+12% from last month'
    },
    {
      title: 'Open Tickets',
      value: stats?.openTickets || 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      change: '5 new today'
    },
    {
      title: 'In Progress',
      value: stats?.inProgressTickets || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      change: '3 being worked on'
    },
    {
      title: 'Resolved',
      value: stats?.resolvedTickets || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: '+8 this week'
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
      title: 'Search Tickets',
      description: 'Find specific tickets quickly',
      icon: Search,
      link: '/tickets?search=',
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  if (user?.role === 'admin') {
    quickActions.push({
      title: 'Manage Categories',
      description: 'Create and edit ticket categories',
      icon: Filter,
      link: '/admin/categories',
      color: 'bg-indigo-500 hover:bg-indigo-600'
    });
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

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-blue-100">
          Here's what's happening with your tickets today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.change}</p>
                </div>
                <div className={`p-3 rounded-full ${card.color} text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className={`${action.color} text-white rounded-lg p-4 transition-all duration-200 transform hover:scale-105`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Tickets</h2>
          <Link
            to="/tickets"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View all →
          </Link>
        </div>
        
        {ticketsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : recentTickets?.tickets?.length > 0 ? (
          <div className="space-y-3">
            {recentTickets.tickets.map((ticket) => (
              <Link
                key={ticket._id}
                to={`/tickets/${ticket._id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{ticket.subject}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {ticket.description.substring(0, 60)}...
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        ticket.status === 'open' ? 'bg-orange-100 text-orange-800' :
                        ticket.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(ticket.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      #{ticket._id.slice(-6)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No tickets yet</p>
            <Link
              to="/tickets/create"
              className="inline-block mt-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first ticket
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 