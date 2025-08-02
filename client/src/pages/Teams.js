import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  UserPlusIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  EyeSlashIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

const Teams = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  
  // Form states
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    isPublic: false,
    allowMemberInvites: true,
    requireApproval: false,
    maxMembers: 50
  });
  
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member'
  });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Handle new message with optimistic updates
  const handleNewMessage = useCallback((data) => {
    if (selectedTeam && data.teamId === selectedTeam._id) {
      setChatMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => msg._id === data.message._id);
        if (exists) return prev;
        
        // Remove optimistic message if it exists
        const filtered = prev.filter(msg => !msg.isOptimistic || msg.content !== data.message.content);
        return [...filtered, data.message];
      });
      
      // Auto-scroll to bottom for new messages
      setTimeout(scrollToBottom, 100);
    }
  }, [selectedTeam, scrollToBottom]);

  // Handle typing indicators
  const handleTypingStart = useCallback((data) => {
    if (selectedTeam && data.teamId === selectedTeam._id && data.userId !== user.id) {
      setTypingUsers(prev => new Set([...prev, data.userName]));
    }
  }, [selectedTeam, user.id]);

  const handleTypingStop = useCallback((data) => {
    if (selectedTeam && data.teamId === selectedTeam._id) {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userName);
        return newSet;
      });
    }
  }, [selectedTeam]);

  // Debounced typing indicator
  const typingTimeoutRef = useRef(null);
  const emitTyping = useCallback((isTyping) => {
    if (!selectedTeam || !socket) return;
    
    socket.emit('team:typing', {
      teamId: selectedTeam._id,
      isTyping,
      userId: user.id,
      userName: user.name
    });
  }, [selectedTeam, socket, user.id, user.name]);

  // Handle typing input
  const handleMessageChange = useCallback((e) => {
    setNewMessage(e.target.value);
    
    // Emit typing start
    if (!isTyping) {
      setIsTyping(true);
      emitTyping(true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      emitTyping(false);
    }, 2000);
  }, [isTyping, emitTyping]);

  useEffect(() => {
    fetchTeams();
    fetchUsers();
    
    if (socket) {
      // Join team room when team is selected
      if (selectedTeam) {
        socket.emit('join:team', { teamId: selectedTeam._id });
      }
      
      // Listen for real-time events
      socket.on('team:message:new', handleNewMessage);
      socket.on('team:typing:start', handleTypingStart);
      socket.on('team:typing:stop', handleTypingStop);
      
      return () => {
        socket.off('team:message:new', handleNewMessage);
        socket.off('team:typing:start', handleTypingStart);
        socket.off('team:typing:stop', handleTypingStop);
        
        // Leave team room
        if (selectedTeam) {
          socket.emit('leave:team', { teamId: selectedTeam._id });
        }
      };
    }
  }, [socket, selectedTeam, handleNewMessage, handleTypingStart, handleTypingStop]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setTeams(data.teams || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const createTeam = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(teamForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(prev => [...prev, data.team]);
        setShowCreateModal(false);
        setTeamForm({
          name: '',
          description: '',
          isPublic: false,
          allowMemberInvites: true,
          requireApproval: false,
          maxMembers: 50
        });
      }
    } catch (error) {
      console.error('Error creating team:', error);
    }
  };

  const selectTeam = async (team) => {
    setSelectedTeam(team);
    setChatMessages([]);
    setCurrentPage(0);
    setHasMoreMessages(true);
    await fetchTeamChat(team._id);
  };

  const fetchTeamChat = async (teamId, page = 0) => {
    if (isLoadingMessages) return;
    
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/chat?page=${page}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (page === 0) {
        setChatMessages(data.messages || []);
        // Auto-scroll to bottom for new team selection
        setTimeout(scrollToBottom, 100);
      } else {
        setChatMessages(prev => [...(data.messages || []), ...prev]);
      }
      
      setHasMoreMessages(data.pagination?.page < data.pagination?.totalPages - 1);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching team chat:', error);
      setChatMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!selectedTeam || isLoadingMessages || !hasMoreMessages) return;
    await fetchTeamChat(selectedTeam._id, currentPage + 1);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeam) return;

    // Optimistic update
    const optimisticMessage = {
      _id: `temp_${Date.now()}`,
      content: newMessage,
      sender: { name: user.name, _id: user.id },
      createdAt: new Date(),
      isOptimistic: true
    };

    setChatMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    // Clear typing indicator
    setIsTyping(false);
    emitTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      const response = await fetch(`/api/teams/${selectedTeam._id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: newMessage })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Replace optimistic message with real message
        setChatMessages(prev => 
          prev.map(msg => 
            msg.isOptimistic ? data.message : msg
          )
        );
      } else {
        // Remove optimistic message if failed
        setChatMessages(prev => prev.filter(msg => !msg.isOptimistic));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message if failed
      setChatMessages(prev => prev.filter(msg => !msg.isOptimistic));
    }
  };

  const inviteMember = async (e) => {
    e.preventDefault();
    if (!inviteForm.email || !selectedTeam) return;

    setInviteError('');
    setInviteSuccess('');

    try {
      const response = await fetch(`/api/teams/${selectedTeam._id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setInviteSuccess('Invitation sent successfully!');
        setInviteForm({ email: '', role: 'member' });
        // Refresh team data to show new member if they were already a user
        await fetchTeams();
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteSuccess('');
        }, 2000);
      } else {
        setInviteError(data.message || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      setInviteError('Failed to send invitation. Please try again.');
    }
  };

  const removeMember = async (userId) => {
    if (!selectedTeam) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam._id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedTeam(data.team);
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const deleteTeam = async () => {
    if (!selectedTeam) return;

    if (window.confirm('Are you sure you want to delete this team?')) {
      try {
        const response = await fetch(`/api/teams/${selectedTeam._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          setTeams(prev => prev.filter(t => t._id !== selectedTeam._id));
          setSelectedTeam(null);
        }
      } catch (error) {
        console.error('Error deleting team:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Teams List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {teams && teams.length > 0 ? (
            teams.map((team) => (
              <div
                key={team._id}
                onClick={() => selectTeam(team)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedTeam?._id === team._id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <UserGroupIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-500">
                        {team.members?.length + 1} members
                      </p>
                    </div>
                  </div>
                  {team.owner?._id === user.id && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Owner
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <UserGroupIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No teams found</p>
              <p className="text-sm">Create your first team to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedTeam ? (
          <>
            {/* Team Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserGroupIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedTeam.name}</h2>
                    <p className="text-gray-600">{selectedTeam.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    <span>Invite</span>
                  </button>
                  <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                  {selectedTeam.owner?._id === user.id && (
                    <button
                      onClick={deleteTeam}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Team Content */}
            <div className="flex-1 flex">
              {/* Team Members */}
              <div className="w-80 bg-white border-r border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>
                <div className="space-y-3">
                  {/* Owner */}
                  {selectedTeam.owner && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {selectedTeam.owner.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedTeam.owner.name}</p>
                          <p className="text-xs text-gray-500">Owner</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Members */}
                  {selectedTeam.members && selectedTeam.members.map((member) => (
                    <div key={member.user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {member.user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                        </div>
                      </div>
                      {(selectedTeam.owner?._id === user.id || selectedTeam.members.find(m => m.user._id === user.id)?.role === 'admin') && (
                        <button
                          onClick={() => removeMember(member.user._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Chat */}
              <div className="flex-1 flex flex-col">
                <div className="bg-white border-b border-gray-200 p-4">
                  <div className="flex items-center space-x-2">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Team Chat</h3>
                  </div>
                </div>
                
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 bg-gray-50 p-4 overflow-y-auto"
                  onScroll={(e) => {
                    // Load more messages when scrolling to top
                    if (e.target.scrollTop < 100 && hasMoreMessages && !isLoadingMessages) {
                      loadMoreMessages();
                    }
                  }}
                >
                  {isLoadingMessages && currentPage > 0 && (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {chatMessages && chatMessages.map((message, index) => {
                      const prevMessage = index > 0 ? chatMessages[index - 1] : null;
                      const showHeader = !prevMessage || 
                        prevMessage.sender._id !== message.sender._id ||
                        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000; // 5 minutes
                      
                      return (
                        <div key={message._id} className={`flex space-x-3 ${message.isOptimistic ? 'opacity-70' : ''}`}>
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-semibold">
                              {message.sender.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              {showHeader && (
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-gray-900">{message.sender.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(message.createdAt).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                  {message.isOptimistic && (
                                    <span className="text-xs text-gray-400">Sending...</span>
                                  )}
                                </div>
                              )}
                              <p className="text-gray-800">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Typing indicators */}
                  {typingUsers.size > 0 && (
                    <div className="flex space-x-3 mt-4">
                      <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">•</span>
                      </div>
                      <div className="flex-1">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                            </span>
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>
                
                <div className="bg-white border-t border-gray-200 p-4">
                  <form onSubmit={sendMessage} className="flex space-x-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={handleMessageChange}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a team</h3>
              <p className="text-gray-500">Choose a team from the sidebar to view details and chat</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Team</h3>
            <form onSubmit={createTeam}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={teamForm.isPublic}
                      onChange={(e) => setTeamForm({ ...teamForm, isPublic: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Public Team</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={teamForm.allowMemberInvites}
                      onChange={(e) => setTeamForm({ ...teamForm, allowMemberInvites: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Allow Invites</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Member</h3>
            <form onSubmit={inviteMember}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="Enter email address"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                {/* Error and Success Messages */}
                {inviteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    {inviteSuccess}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError('');
                    setInviteSuccess('');
                    setInviteForm({ email: '', role: 'member' });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams; 