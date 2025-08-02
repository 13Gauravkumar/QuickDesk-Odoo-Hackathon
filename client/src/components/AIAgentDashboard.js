import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bot, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  Users,
  Zap,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import AIChatbotWidget from './AIChatbotWidget';

const AIAgentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [categoryStats, setCategoryStats] = useState([]);
  const [periodStats, setPeriodStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch main stats
      const statsResponse = await fetch('/api/ai-agent/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch category stats
      const categoryResponse = await fetch('/api/ai-agent/stats/by-category', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        setCategoryStats(categoryData.categoryStats);
      }

      // Fetch period stats
      const periodResponse = await fetch(`/api/ai-agent/stats/by-period?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (periodResponse.ok) {
        const periodData = await periodResponse.json();
        setPeriodStats(periodData.periodStats);
      }

    } catch (error) {
      console.error('Error fetching AI agent stats:', error);
      toast.error('Failed to load AI agent statistics');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    fetchPeriodStats(period);
  };

  const fetchPeriodStats = async (period) => {
    try {
      const response = await fetch(`/api/ai-agent/stats/by-period?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPeriodStats(data.periodStats);
      }
    } catch (error) {
      console.error('Error fetching period stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No AI agent statistics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agent Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-400">Performance metrics and statistics</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsChatbotOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </button>
          <button
            onClick={fetchStats}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Resolved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.agentStats.totalResolved || 0}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolution Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.analytics.aiResolutionRate.toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Resolution Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(stats.agentStats.avgResolutionTime || 0)}m
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round((stats.agentStats.avgConfidence || 0) * 100)}%
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance by Category
          </h3>
          <div className="space-y-4">
            {categoryStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {stat.categoryInfo?.[0]?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.count} tickets resolved
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {Math.round(stat.avgResolutionTime || 0)}m
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round((stat.avgConfidence || 0) * 100)}% confidence
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Period Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Performance Over Time
            </h3>
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div className="space-y-3">
            {periodStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {stat._id}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.count} tickets
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {Math.round(stat.avgResolutionTime || 0)}m avg
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detailed Analytics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Total Tickets</h4>
            <p className="text-3xl font-bold text-blue-600">{stats.analytics.totalTickets}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">AI Resolved</h4>
            <p className="text-3xl font-bold text-green-600">{stats.analytics.aiResolvedTickets}</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Human Resolved</h4>
            <p className="text-3xl font-bold text-purple-600">
              {stats.analytics.totalTickets - stats.analytics.aiResolvedTickets}
            </p>
          </div>
        </div>
      </div>

      {/* AI Agent Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Agent Status</h3>
            <p className="text-gray-600 dark:text-gray-400">Current system status and capabilities</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h4 className="font-medium text-green-900 dark:text-green-100">Capabilities</h4>
            <ul className="mt-2 text-sm text-green-700 dark:text-green-300 space-y-1">
              <li>• Ticket analysis and classification</li>
              <li>• Auto-resolution for common issues</li>
              <li>• Response suggestions</li>
              <li>• Knowledge base integration</li>
            </ul>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Performance</h4>
            <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• {stats.analytics.aiResolutionRate.toFixed(1)}% resolution rate</li>
              <li>• {Math.round(stats.agentStats.avgResolutionTime || 0)}m average time</li>
              <li>• {Math.round((stats.agentStats.avgConfidence || 0) * 100)}% confidence</li>
              <li>• Real-time processing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* AI Chatbot Widget */}
      <AIChatbotWidget 
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
      />
    </div>
  );
};

export default AIAgentDashboard; 