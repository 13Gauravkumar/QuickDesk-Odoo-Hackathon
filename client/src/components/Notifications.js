import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Bell, X, CheckCircle, AlertCircle, MessageSquare, User, Tag } from 'lucide-react';
import { format } from 'date-fns';

const Notifications = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load notifications from localStorage
    const savedNotifications = localStorage.getItem('quickdesk_notifications');
    if (savedNotifications) {
      const parsed = JSON.parse(savedNotifications);
      setNotifications(parsed);
      setUnreadCount(parsed.filter(n => !n.read).length);
    }
  }, []);

  useEffect(() => {
    // Listen for real-time notifications
    const handleNewNotification = (data) => {
      const newNotification = {
        id: Date.now(),
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date(),
        read: false,
        data: data.data || {}
      };

      setNotifications(prev => {
        const updated = [newNotification, ...prev.slice(0, 49)]; // Keep only last 50
        localStorage.setItem('quickdesk_notifications', JSON.stringify(updated));
        return updated;
      });

      setUnreadCount(prev => prev + 1);
    };

    // Listen for socket events
    if (socket && socket.on) {
      socket.on('notification:new', handleNewNotification);
      socket.on('ticket:created', (data) => {
        handleNewNotification({
          type: 'ticket',
          title: 'New Ticket Created',
          message: `Ticket "${data.ticket.subject}" has been created`,
          data
        });
      });
      socket.on('ticket:updated', (data) => {
        handleNewNotification({
          type: 'ticket',
          title: 'Ticket Updated',
          message: `Ticket "${data.ticket.subject}" has been updated`,
          data
        });
      });
      socket.on('ticket:commentAdded', (data) => {
        handleNewNotification({
          type: 'comment',
          title: 'New Comment',
          message: `New comment added to ticket "${data.ticket.subject}"`,
          data
        });
      });
    }

    return () => {
      if (socket && socket.off) {
        socket.off('notification:new', handleNewNotification);
        socket.off('ticket:created', handleNewNotification);
        socket.off('ticket:updated', handleNewNotification);
        socket.off('ticket:commentAdded', handleNewNotification);
      }
    };
  }, [socket]);

  const markAsRead = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem('quickdesk_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('quickdesk_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('quickdesk_notifications');
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ticket':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'comment':
        return <User className="w-5 h-5 text-green-500" />;
      case 'system':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'ticket':
        return 'border-l-blue-500 bg-blue-50';
      case 'comment':
        return 'border-l-green-500 bg-green-50';
      case 'system':
        return 'border-l-orange-500 bg-orange-50';
      case 'success':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
                <button
                  onClick={clearNotifications}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getNotificationColor(notification.type)} ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(notification.timestamp), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default Notifications; 