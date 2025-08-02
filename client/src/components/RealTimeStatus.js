import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { 
  Database, 
  Wifi, 
  Brain, 
  HardDrive, 
  Network,
  Users,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Server,
  Cpu,
  Monitor,
  Smartphone,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Target,
  Award,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Settings
} from 'lucide-react';

const RealTimeStatus = () => {
  const { socket } = useSocket();
  const [systemStatus, setSystemStatus] = useState({
    database: { status: 'online', latency: '12ms' },
    realtime: { status: 'active', connections: 0 },
    ai: { status: 'available', responseTime: '1.2s' },
    storage: { status: 'healthy', usage: '68%' },
    network: { status: 'stable', bandwidth: '2.1GB/s' }
  });
  const [activeUsers, setActiveUsers] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    avgResponseTime: '2.5h',
    resolutionRate: '85%',
    slaCompliance: '92%',
    activeTickets: 45,
    resolvedToday: 12
  });
  const [liveActivity, setLiveActivity] = useState([]);

  useEffect(() => {
    if (socket && socket.on) {
      // System status updates
      socket.on('system:status_update', (data) => {
        setSystemStatus(data);
      });

      // Active users updates
      socket.on('users:active_update', (data) => {
        setActiveUsers(data.users);
      });

      // Performance metrics updates
      socket.on('performance:metrics_update', (data) => {
        setPerformanceMetrics(data);
      });

      // Live activity updates
      socket.on('live:activity', (activity) => {
        setLiveActivity(prev => [activity, ...prev.slice(0, 19)]);
      });

      // Request initial data
      socket.emit('system:status_request');
      socket.emit('users:active_request');
      socket.emit('performance:metrics_request');

      // Set up periodic updates
      const interval = setInterval(() => {
        socket.emit('system:status_request');
        socket.emit('users:active_request');
        socket.emit('performance:metrics_request');
      }, 30000); // Update every 30 seconds

      return () => {
        clearInterval(interval);
        if (socket && socket.off) {
          socket.off('system:status_update');
          socket.off('users:active_update');
          socket.off('performance:metrics_update');
          socket.off('live:activity');
        }
      };
    }
  }, [socket]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'available':
      case 'healthy':
      case 'stable':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>;
      case 'warning':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>;
      case 'error':
      case 'offline':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
    }
  };

  const getServiceIcon = (service) => {
    switch (service) {
      case 'database':
        return <Database className="w-4 h-4 text-blue-600" />;
      case 'realtime':
        return <Wifi className="w-4 h-4 text-green-600" />;
      case 'ai':
        return <Brain className="w-4 h-4 text-purple-600" />;
      case 'storage':
        return <HardDrive className="w-4 h-4 text-orange-600" />;
      case 'network':
        return <Network className="w-4 h-4 text-indigo-600" />;
      default:
        return <Server className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPerformanceIcon = (metric) => {
    switch (metric) {
      case 'avgResponseTime':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'resolutionRate':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'slaCompliance':
        return <Target className="w-4 h-4 text-purple-600" />;
      case 'activeTickets':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'resolvedToday':
        return <Award className="w-4 h-4 text-green-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Status</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-500">Real-time</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(systemStatus).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                {getServiceIcon(service)}
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{service}</span>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status.status)}
                    <span className="text-xs text-green-600 capitalize">{status.status}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">
                  {service === 'database' && status.latency}
                  {service === 'realtime' && `${status.connections} connections`}
                  {service === 'ai' && status.responseTime}
                  {service === 'storage' && status.usage}
                  {service === 'network' && status.bandwidth}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Metrics</h3>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(performanceMetrics).map(([metric, value]) => (
            <div key={metric} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                {getPerformanceIcon(metric)}
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Users</h3>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-500">{activeUsers.length} online</span>
          </div>
        </div>
        <div className="space-y-2">
          {activeUsers.length > 0 ? (
            activeUsers.map((user, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-900 dark:text-white">{user}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No active users</p>
            </div>
          )}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Activity</h3>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Real-time</span>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {liveActivity.length > 0 ? (
            liveActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Health</h3>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-500">Optimal</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Cpu className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">CPU</p>
            <p className="text-xs text-green-600">45%</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <HardDrive className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Memory</p>
            <p className="text-xs text-blue-600">68%</p>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Network className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Network</p>
            <p className="text-xs text-purple-600">2.1GB/s</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <Database className="w-6 h-6 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Database</p>
            <p className="text-xs text-orange-600">12ms</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeStatus; 