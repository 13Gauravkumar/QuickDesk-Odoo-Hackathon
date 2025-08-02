import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { Wifi, WifiOff, Activity, Zap } from 'lucide-react';

const RealTimeStatus = () => {
  const { socket, isConnected } = useSocket();
  const [lastActivity, setLastActivity] = useState(null);
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    if (socket && socket.on) {
      const handleActivity = () => {
        setLastActivity(new Date());
        setActivityCount(prev => prev + 1);
      };

      // Listen for various real-time events
      const events = [
        'ticket:created',
        'ticket:updated',
        'ticket:deleted',
        'ticket:assigned',
        'ticket:commentAdded',
        'knowledge:article_viewed',
        'knowledge:article_rated',
        'dashboard:stats:updated'
      ];

      events.forEach(event => {
        socket.on(event, handleActivity);
      });

      return () => {
        events.forEach(event => {
          socket.off(event, handleActivity);
        });
      };
    }
  }, [socket]);

  const getStatusColor = () => {
    if (!isConnected) return 'text-red-500';
    if (lastActivity && Date.now() - lastActivity.getTime() < 30000) {
      return 'text-green-500';
    }
    return 'text-yellow-500';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (lastActivity && Date.now() - lastActivity.getTime() < 30000) {
      return 'Active';
    }
    return 'Connected';
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
        {isConnected ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        <span>{getStatusText()}</span>
      </div>
      
      {isConnected && (
        <div className="flex items-center space-x-1 text-gray-500">
          <Activity className="w-4 h-4" />
          <span>{activityCount}</span>
        </div>
      )}
      
      {lastActivity && Date.now() - lastActivity.getTime() < 5000 && (
        <div className="flex items-center space-x-1 text-green-500 animate-pulse">
          <Zap className="w-4 h-4" />
          <span>Live</span>
        </div>
      )}
    </div>
  );
};

export default RealTimeStatus; 