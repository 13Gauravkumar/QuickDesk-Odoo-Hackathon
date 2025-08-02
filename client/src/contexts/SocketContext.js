import React, { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const SocketProvider = ({ children, socket }) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    // Handle ticket created
    socket.on('ticket:created', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      toast.success('New ticket created!');
    });

    // Handle ticket updated
    socket.on('ticket:updated', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['ticket', ticket._id]);
      toast.success('Ticket updated!');
    });

    // Handle ticket assigned
    socket.on('ticket:assigned', ({ ticket }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['ticket', ticket._id]);
      toast.success('Ticket assigned!');
    });

    // Handle new comment
    socket.on('ticket:comment', ({ ticketId, comment }) => {
      queryClient.invalidateQueries(['ticket', ticketId]);
      toast.success('New comment added!');
    });

    // Handle ticket deleted
    socket.on('ticket:deleted', ({ ticketId }) => {
      queryClient.invalidateQueries(['tickets']);
      queryClient.removeQueries(['ticket', ticketId]);
      toast.success('Ticket deleted!');
    });

    return () => {
      socket.off('ticket:created');
      socket.off('ticket:updated');
      socket.off('ticket:assigned');
      socket.off('ticket:comment');
      socket.off('ticket:deleted');
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