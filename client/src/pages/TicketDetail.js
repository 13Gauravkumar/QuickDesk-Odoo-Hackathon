import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { 
  ArrowLeft,
  MessageSquare,
  User,
  Calendar,
  Tag,
  AlertCircle,
  Clock,
  CheckCircle,
  Download,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Upload,
  Send,
  Edit,
  Trash2,
  MoreVertical,
  File,
  Image,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [attachments, setAttachments] = useState([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue
  } = useForm();

  // Fetch ticket details
  const { data: ticket, isLoading, error } = useQuery(
    ['ticket', id],
    async () => {
      const response = await fetch(`/api/tickets/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Ticket not found');
      }
      return response.json();
    }
  );

  // Fetch categories for assignment
  const { data: categoriesData } = useQuery('categories', async () => {
    const response = await fetch('/api/categories', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // File dropzone for comments
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const newAttachments = acceptedFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9)
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    },
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.md']
    },
    maxSize: 5 * 1024 * 1024,
    multiple: true
  });

  // Add comment mutation
  const addCommentMutation = useMutation(
    async (data) => {
      const formData = new FormData();
      formData.append('content', data.content);
      
      attachments.forEach(attachment => {
        formData.append('attachments', attachment.file);
      });

      const response = await fetch(`/api/tickets/${id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id]);
        reset();
        setAttachments([]);
        setShowCommentForm(false);
        toast.success('Comment added successfully');
      },
      onError: () => {
        toast.error('Failed to add comment');
      }
    }
  );

  // Update ticket status mutation
  const updateStatusMutation = useMutation(
    async (status) => {
      const response = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id]);
        toast.success('Status updated successfully');
      },
      onError: () => {
        toast.error('Failed to update status');
      }
    }
  );

  // Assign ticket mutation
  const assignTicketMutation = useMutation(
    async (assignedTo) => {
      const response = await fetch(`/api/tickets/${id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ assignedTo })
      });

      if (!response.ok) {
        throw new Error('Failed to assign ticket');
      }

      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id]);
        toast.success('Ticket assigned successfully');
      },
      onError: () => {
        toast.error('Failed to assign ticket');
      }
    }
  );

  // Vote mutation
  const voteMutation = useMutation(
    async (voteType) => {
      const response = await fetch(`/api/tickets/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ voteType })
      });

      if (!response.ok) {
        throw new Error('Failed to record vote');
      }

      return response.json();
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['ticket', id]);
        toast.success('Vote recorded successfully');
      },
      onError: () => {
        toast.error('Failed to record vote');
      }
    }
  );

  const onSubmitComment = (data) => {
    addCommentMutation.mutate(data);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed':
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'low':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
      return <Image className="w-4 h-4" />;
    } else if (ext === 'pdf') {
      return <FileText className="w-4 h-4" />;
    } else {
      return <File className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Ticket Not Found</h2>
        <p className="text-gray-600 mb-4">The ticket you're looking for doesn't exist or you don't have permission to view it.</p>
        <button
          onClick={() => navigate('/tickets')}
          className="btn-primary"
        >
          Back to Tickets
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/tickets')}
            className="btn-secondary flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tickets</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{ticket?.subject}</h1>
            <p className="text-gray-600">#{ticket?._id?.slice(-6)}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Vote buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => voteMutation.mutate('upvote')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Upvote"
            >
              <ThumbsUp className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm text-gray-600">{ticket?.upvotes?.length || 0}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => voteMutation.mutate('downvote')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Downvote"
            >
              <ThumbsDown className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm text-gray-600">{ticket?.downvotes?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                {getStatusIcon(ticket?.status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(ticket?.priority)}`}>
                  {ticket?.priority}
                </span>
              </div>
              
              {/* Status Update (for agents/admins) */}
              {(user?.role === 'agent' || user?.role === 'admin') && (
                <select
                  value={ticket?.status}
                  onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              )}
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{ticket?.description}</p>
            </div>

            {/* Attachments */}
            {ticket?.attachments?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Attachments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ticket.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {getFileIcon(attachment.filename)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <a
                        href={`/uploads/${attachment.filename}`}
                        download
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-gray-500" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
              <button
                onClick={() => setShowCommentForm(!showCommentForm)}
                className="btn-primary flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Add Comment</span>
              </button>
            </div>

            {/* Comment Form */}
            {showCommentForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <form onSubmit={handleSubmit(onSubmitComment)} className="space-y-4">
                  <textarea
                    {...register('content', { required: 'Comment is required' })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add your comment..."
                  />
                  
                  {/* File attachments for comment */}
                  <div>
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                        isDragActive 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      {isDragActive ? (
                        <p className="text-blue-600">Drop files here...</p>
                      ) : (
                        <p className="text-gray-600">Drag & drop files or click to select</p>
                      )}
                    </div>
                    
                    {attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <div className="flex items-center space-x-2">
                              <File className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">{attachment.file.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachments(prev => prev.filter(a => a.id !== attachment.id))}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCommentForm(false);
                        reset();
                        setAttachments([]);
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Post Comment</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {ticket?.comments?.length > 0 ? (
                ticket.comments.map((comment, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 mb-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          {comment.user?.name || 'Unknown User'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>

                    {/* Comment attachments */}
                    {comment.attachments?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {comment.attachments.map((attachment, attIndex) => (
                            <a
                              key={attIndex}
                              href={`/uploads/${attachment.filename}`}
                              download
                              className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              {getFileIcon(attachment.filename)}
                              <span className="text-sm">{attachment.filename}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(ticket?.status)}
                  <span className="capitalize">{ticket?.status}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket?.priority)}`}>
                  {ticket?.priority}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span>{ticket?.category?.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{ticket?.createdBy?.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>{format(new Date(ticket?.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                </div>
              </div>

              {ticket?.assignedTo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span>{ticket.assignedTo.name}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>{format(new Date(ticket?.updatedAt), 'MMM dd, yyyy HH:mm')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment (for agents/admins) */}
          {(user?.role === 'agent' || user?.role === 'admin') && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Agent
                  </label>
                  <select
                    value={ticket?.assignedTo?._id || ''}
                    onChange={(e) => assignTicketMutation.mutate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {/* Add agent options here */}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetail; 