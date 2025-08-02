import React, { useState, useEffect } from 'react';
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
  EyeSlashIcon
} from '@heroicons/react/24/outline';

const Teams = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  
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
    userId: '',
    role: 'member'
  });

  useEffect(() => {
    fetchTeams();
    fetchUsers();
    
    if (socket) {
      socket.on('team:message:new', handleNewMessage);
      return () => {
        socket.off('team:message:new', handleNewMessage);
      };
    }
  }, [socket]);

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTeams(data.teams);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teams:', error);
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
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleNewMessage = (data) => {
    if (selectedTeam && data.teamId === selectedTeam._id) {
      setChatMessages(prev => [...prev, data.message]);
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
    await fetchTeamChat(team._id);
  };

  const fetchTeamChat = async (teamId) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/chat`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setChatMessages(data.messages);
    } catch (error) {
      console.error('Error fetching team chat:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeam) return;

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
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const inviteMember = async (e) => {
    e.preventDefault();
    if (!inviteForm.userId || !selectedTeam) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeam._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(inviteForm)
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedTeam(data.team);
        setShowInviteModal(false);
        setInviteForm({ userId: '', role: 'member' });
      }
    } catch (error) {
      console.error('Error inviting member:', error);
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
          {teams.map((team) => (
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
                      {team.members.length + 1} members
                    </p>
                  </div>
                </div>
                {team.owner._id === user.id && (
                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    Owner
                  </div>
                )}
              </div>
            </div>
          ))}
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
                  {selectedTeam.owner._id === user.id && (
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
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {selectedTeam.owner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{selectedTeam.owner.name}</p>
                        <p className="text-xs text-gray-500">Owner</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Members */}
                  {selectedTeam.members.map((member) => (
                    <div key={member.user._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-semibold">
                            {member.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                        </div>
                      </div>
                      {(selectedTeam.owner._id === user.id || selectedTeam.members.find(m => m.user._id === user.id)?.role === 'admin') && (
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
                
                <div className="flex-1 bg-gray-50 p-4 overflow-y-auto">
                  <div className="space-y-4">
                    {chatMessages.map((message) => (
                      <div key={message._id} className="flex space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">
                            {message.sender.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-white rounded-lg p-3 shadow-sm">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900">{message.sender.name}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(message.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-gray-800">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-white border-t border-gray-200 p-4">
                  <form onSubmit={sendMessage} className="flex space-x-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Send
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                  <select
                    value={inviteForm.userId}
                    onChange={(e) => setInviteForm({ ...inviteForm, userId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Choose a user...</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
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
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Invite
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