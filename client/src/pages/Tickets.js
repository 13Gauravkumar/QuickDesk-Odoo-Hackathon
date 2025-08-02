import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Ticket, 
  Search, 
  Plus, 
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  User,
  AlertCircle,
  Clock,
  CheckCircle,
  X,
  Zap,
  Brain,
  Settings,
  Star,
  TrendingUp,
  Workflow
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Tickets = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || '-createdAt');
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced features
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [workflowMode, setWorkflowMode] = useState(false);
  const [smartFilters, setSmartFilters] = useState({
    overdue: false,
    highPriority: false,
    unassigned: false,
    myTickets: false,
    recentActivity: false
  });

  // Fetch tickets with filters
  const { data: ticketsData, isLoading } = useQuery(
    ['tickets', search, statusFilter, categoryFilter, priorityFilter, sortBy, smartFilters],
    async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (sortBy) params.append('sort', sortBy);
      
      // Add smart filters
      Object.entries(smartFilters).forEach(([key, value]) => {
        if (value) params.append(key, 'true');
      });
      
      const response = await fetch(`/api/tickets?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.json();
    }
  );

  // Fetch categories for filter
  const { data: categories } = useQuery('categories', async () => {
    const response = await fetch('/api/categories', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // AI suggestions
  const { data: suggestions } = useQuery(
    ['ai-suggestions', search],
    async () => {
      if (!search || search.length < 3) return [];
      
      const response = await fetch(`/api/tickets/ai-suggestions?query=${encodeURIComponent(search)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.json();
    },
    {
      enabled: Boolean(search && search.length >= 3)
    }
  );

  // Real-time updates
  useEffect(() => {
    if (socket && socket.on) {
      // Ticket events
      socket.on('ticket:created', (data) => {
        queryClient.invalidateQueries(['tickets']);
        toast.success(`New ticket created: ${data.ticket.subject}`);
      });

      socket.on('ticket:updated', (data) => {
        queryClient.invalidateQueries(['tickets']);
        queryClient.invalidateQueries(['ticket', data.ticket._id]);
        toast.info(`Ticket updated: ${data.ticket.subject}`);
      });

      socket.on('ticket:deleted', (data) => {
        queryClient.invalidateQueries(['tickets']);
        queryClient.removeQueries(['ticket', data.ticketId]);
        toast.info('Ticket deleted');
      });

      socket.on('ticket:assigned', (data) => {
        queryClient.invalidateQueries(['tickets']);
        queryClient.invalidateQueries(['ticket', data.ticket._id]);
        toast.success(`Ticket assigned: ${data.ticket.subject}`);
      });

      socket.on('ticket:commentAdded', (data) => {
        queryClient.invalidateQueries(['ticket', data.ticketId]);
        toast.info(`New comment on ticket: ${data.ticket.subject}`);
      });

      socket.on('ticket:bulk_updated', (data) => {
        queryClient.invalidateQueries(['tickets']);
        toast.success(`Bulk operation completed: ${data.modifiedCount} tickets updated`);
      });

      return () => {
        if (socket && socket.off) {
          socket.off('ticket:created');
          socket.off('ticket:updated');
          socket.off('ticket:deleted');
          socket.off('ticket:assigned');
          socket.off('ticket:commentAdded');
          socket.off('ticket:bulk_updated');
        }
      };
    }
  }, [socket, queryClient]);

  // Vote mutation
  const voteMutation = useMutation(
    async ({ ticketId, voteType }) => {
      const response = await fetch(`/api/tickets/${ticketId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ voteType })
      });
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets');
        toast.success('Vote recorded successfully');
      },
      onError: () => {
        toast.error('Failed to record vote');
      }
    }
  );

  // Bulk operations mutation
  const bulkOperationMutation = useMutation(
    async ({ operation, ticketIds, data }) => {
      const response = await fetch('/api/tickets/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ operation, ticketIds, data })
      });
      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tickets');
        setSelectedTickets([]);
        setShowBulkActions(false);
        toast.success('Bulk operation completed successfully');
      },
      onError: () => {
        toast.error('Failed to perform bulk operation');
      }
    }
  );

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (sortBy) params.set('sort', sortBy);
    setSearchParams(params);
  }, [search, statusFilter, categoryFilter, priorityFilter, sortBy, setSearchParams]);

  // Update AI suggestions
  useEffect(() => {
    if (suggestions) {
      setAiSuggestions(suggestions);
    }
  }, [suggestions]);

  const handleVote = (ticketId, voteType) => {
    voteMutation.mutate({ ticketId, voteType });
  };

  const handleTicketSelect = (ticketId) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTickets.length === ticketsData?.tickets?.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(ticketsData?.tickets?.map(ticket => ticket._id) || []);
    }
  };

  const handleBulkOperation = (operation, data = {}) => {
    if (selectedTickets.length === 0) {
      toast.error('Please select tickets first');
      return;
    }
    
    bulkOperationMutation.mutate({
      operation,
      ticketIds: selectedTickets,
      data
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'in-progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'closed':
        return <X className="w-4 h-4 text-gray-500" />;
      default:
        return <Ticket className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 168) {
      return format(date, 'EEE');
    } else {
      return format(date, 'MMM d');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setSortBy('-createdAt');
    setSmartFilters({
      overdue: false,
      highPriority: false,
      unassigned: false,
      myTickets: false,
      recentActivity: false
    });
  };

  const getSmartFilterCount = (filterType) => {
    if (!ticketsData?.tickets) return 0;
    
    switch (filterType) {
      case 'overdue':
        return ticketsData.tickets.filter(ticket => 
          ticket.status === 'open' && 
          new Date(ticket.createdAt) < new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length;
      case 'highPriority':
        return ticketsData.tickets.filter(ticket => 
          ['urgent', 'high'].includes(ticket.priority)
        ).length;
      case 'unassigned':
        return ticketsData.tickets.filter(ticket => 
          !ticket.assignedTo
        ).length;
      case 'myTickets':
        return ticketsData.tickets.filter(ticket => 
          ticket.assignedTo?._id === user?.id
        ).length;
      default:
        return 0;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tickets</h1>
            <p className="text-gray-600">
              Manage and track support tickets with advanced workflow automation.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setWorkflowMode(!workflowMode)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                workflowMode 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Workflow className="w-4 h-4" />
              <span>Workflow Mode</span>
            </button>
            <Link
              to="/tickets/create"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Ticket</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Smart Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">Smart Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {showFilters ? 'Hide' : 'Show'} Advanced Filters
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Object.entries(smartFilters).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setSmartFilters(prev => ({ ...prev, [key]: !value }))}
              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {key === 'overdue' && <Clock className="w-3 h-3" />}
              {key === 'highPriority' && <AlertCircle className="w-3 h-3" />}
              {key === 'unassigned' && <User className="w-3 h-3" />}
              {key === 'myTickets' && <Star className="w-3 h-3" />}
              {key === 'recentActivity' && <TrendingUp className="w-3 h-3" />}
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              {getSmartFilterCount(key) > 0 && (
                <span className="bg-white px-1 rounded-full text-xs">
                  {getSmartFilterCount(key)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tickets with AI assistance..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-blue-100"
                title="AI Search"
              >
                <Brain className="w-4 h-4 text-blue-600" />
              </button>
            </div>
            
            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {aiSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => setSearch(suggestion.query)}
                  >
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">{suggestion.suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories?.categories?.map(category => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="-createdAt">Newest First</option>
              <option value="createdAt">Oldest First</option>
              <option value="-priority">Priority</option>
              <option value="-votes">Most Voted</option>
              <option value="-comments">Most Comments</option>
            </select>
          </div>
        </div>
        
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={smartFilters.overdue}
                    onChange={(e) => setSmartFilters(prev => ({ ...prev, overdue: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Overdue Tickets</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={smartFilters.highPriority}
                    onChange={(e) => setSmartFilters(prev => ({ ...prev, highPriority: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">High Priority</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={smartFilters.unassigned}
                    onChange={(e) => setSmartFilters(prev => ({ ...prev, unassigned: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Unassigned</span>
                </label>
              </div>
              <button
                onClick={clearFilters}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedTickets.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-800">
                {selectedTickets.length} ticket(s) selected
              </span>
              <button
                onClick={() => setSelectedTickets([])}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkOperation('assign', { assignee: user?.id })}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <User className="w-3 h-3" />
                <span>Assign to Me</span>
              </button>
              <button
                onClick={() => handleBulkOperation('status', { status: 'in-progress' })}
                className="flex items-center space-x-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
              >
                <Clock className="w-3 h-3" />
                <span>Mark In Progress</span>
              </button>
              <button
                onClick={() => handleBulkOperation('status', { status: 'resolved' })}
                className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                <CheckCircle className="w-3 h-3" />
                <span>Resolve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {ticketsData?.tickets?.length || 0} Tickets
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {selectedTickets.length === ticketsData?.tickets?.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                <Settings className="w-3 h-3" />
                <span>Bulk Actions</span>
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : ticketsData?.tickets?.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {ticketsData.tickets.map((ticket) => (
              <div
                key={ticket._id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  selectedTickets.includes(ticket._id) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedTickets.includes(ticket._id)}
                    onChange={() => handleTicketSelect(ticket._id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(ticket.status)}
                          <Link
                            to={`/tickets/${ticket._id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                          >
                            {ticket.title}
                          </Link>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          {ticket.featured && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Featured
                            </span>
                          )}
                        </div>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">
                          {ticket.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>#{ticket._id.slice(-6)}</span>
                          <span>Created {formatDate(ticket.createdAt)}</span>
                          {ticket.assignedTo && (
                            <span>Assigned to {ticket.assignedTo.name}</span>
                          )}
                          {ticket.category && (
                            <span>Category: {ticket.category.name}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleVote(ticket._id, 'up')}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <ThumbsUp className="w-4 h-4 text-gray-500" />
                          </button>
                          <span className="text-sm text-gray-600">{ticket.upvotes || 0}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleVote(ticket._id, 'down')}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <ThumbsDown className="w-4 h-4 text-gray-500" />
                          </button>
                          <span className="text-sm text-gray-600">{ticket.downvotes || 0}</span>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <MessageSquare className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{ticket.comments?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-600">
              {search || statusFilter || categoryFilter || priorityFilter
                ? 'Try adjusting your filters.'
                : 'No tickets have been created yet.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tickets; 