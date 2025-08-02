import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';

const ChatbotWidget = ({ isOpen, onClose, onTicketCreate }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !conversation) {
      startNewConversation();
    }
  }, [isOpen]);

  const startNewConversation = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post('/api/chatbot', {
        initialMessage: 'Hello, I need help'
      });
      
      setConversation(response.data.conversation);
      setMessages(response.data.conversation.messages || []);
      
      if (response.data.botResponse) {
        setMessages(prev => [...prev, {
          content: response.data.botResponse.content,
          sender: 'bot',
          timestamp: new Date(),
          metadata: {
            confidence: response.data.botResponse.confidence,
            suggestedActions: response.data.botResponse.suggestedActions
          }
        }]);
        setSuggestedActions(response.data.botResponse.suggestedActions || []);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content) => {
    if (!content.trim() || !conversation) return;

    const userMessage = {
      content,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(`/api/chatbot/${conversation._id}/messages`, {
        content,
        messageType: 'text'
      });

      setConversation(response.data.conversation);

      if (response.data.botResponse) {
        const botMessage = {
          content: response.data.botResponse.content,
          sender: 'bot',
          timestamp: new Date(),
          metadata: {
            confidence: response.data.botResponse.confidence,
            suggestedActions: response.data.botResponse.suggestedActions
          }
        };

        setMessages(prev => [...prev, botMessage]);
        setSuggestedActions(response.data.botResponse.suggestedActions || []);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleSuggestedAction = async (action) => {
    switch (action.value) {
      case 'create_ticket':
        if (onTicketCreate) {
          onTicketCreate();
          onClose();
        }
        break;
      case 'check_status':
        // Navigate to tickets page
        window.location.href = '/tickets';
        break;
      case 'knowledge_base':
        // Navigate to knowledge base
        window.location.href = '/knowledge-base';
        break;
      case 'contact_agent':
        sendMessage('I would like to speak with a human agent.');
        break;
      default:
        sendMessage(action.label);
    }
  };

  const handleSatisfaction = async (rating) => {
    try {
      await axios.post(`/api/chatbot/${conversation._id}/satisfaction`, {
        rating,
        feedback: 'Chat satisfaction rating'
      });
      
      setMessages(prev => [...prev, {
        content: 'Thank you for your feedback!',
        sender: 'bot',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error submitting satisfaction:', error);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-bold text-sm">AI</span>
          </div>
          <div>
            <h3 className="font-semibold">QuickDesk Support</h3>
            <p className="text-xs opacity-90">AI Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {formatTime(message.timestamp)}
              </p>
              
              {message.metadata?.confidence && (
                <div className="mt-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs opacity-75">Confidence:</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-green-500 h-1 rounded-full"
                        style={{ width: `${message.metadata.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs opacity-75">
                      {Math.round(message.metadata.confidence * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedAction(action)}
                className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>

      {/* Satisfaction Rating */}
      {conversation?.status === 'resolved' && (
        <div className="px-4 pb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 mb-2">How was your experience?</p>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleSatisfaction(rating)}
                  className="text-2xl hover:scale-110 transition-transform"
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotWidget; 