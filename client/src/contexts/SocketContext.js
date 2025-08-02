import React, { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const SocketProvider = ({ children, socket }) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !socket.on) return;

    // Handle ticket created
    socket.on('ticket:created', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['dashboard-stats']);
      queryClient.invalidateQueries(['analytics']);
      toast.success('New ticket created!');
    });

    // Handle ticket updated
    socket.on('ticket:updated', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['ticket', ticket._id]);
      queryClient.invalidateQueries(['analytics']);
      toast.success('Ticket updated!');
    });

    // Handle ticket assigned
    socket.on('ticket:assigned', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['ticket', ticket._id]);
      toast.success('Ticket assigned!');
    });

    // Handle new comment
    socket.on('ticket:commentAdded', ({ ticketId, comment, ticket }) => {
      queryClient.invalidateQueries(['ticket', ticketId]);
      toast.success('New comment added!');
    });

    // Handle ticket deleted
    socket.on('ticket:deleted', ({ ticketId }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.removeQueries(['ticket', ticketId]);
      queryClient.invalidateQueries(['analytics']);
      toast.success('Ticket deleted!');
    });

    // Handle bulk operations
    socket.on('ticket:bulk_updated', ({ operation, ticketIds, modifiedCount }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['analytics']);
      toast.success(`Bulk operation completed: ${modifiedCount} tickets updated`);
    });

    // Handle dashboard stats updates
    socket.on('dashboard:stats:updated', (data) => {
      queryClient.invalidateQueries(['dashboard-stats']);
      queryClient.invalidateQueries(['analytics']);
    });

    // Handle knowledge base events
    socket.on('knowledge:article_viewed', (data) => {
      console.log(`Article viewed: ${data.title}`);
    });

    socket.on('knowledge:article_rated', (data) => {
      queryClient.invalidateQueries(['knowledge-base']);
      toast.success(`Article rated: ${data.title}`);
    });

    // Handle notifications
    socket.on('notification:new', (notification) => {
      toast(notification.message, {
        icon: notification.type === 'urgent' ? '🔴' : '🔵'
      });
    });

    return () => {
      if (socket && socket.off) {
        socket.off('ticket:created');
        socket.off('ticket:updated');
        socket.off('ticket:assigned');
        socket.off('ticket:commentAdded');
        socket.off('ticket:deleted');
        socket.off('ticket:bulk_updated');
        socket.off('dashboard:stats:updated');
        socket.off('knowledge:article_viewed');
        socket.off('knowledge:article_rated');
        socket.off('notification:new');
      }
    };
  }, [socket, queryClient]);

  const value = {
    socket,
    isConnected: socket?.connected || false,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}; 