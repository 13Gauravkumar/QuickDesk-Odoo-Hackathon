import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  Sparkles, 
  X, 
  Minimize2,
  Maximize2,
  Settings,
  Brain,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const AIChatbotWidget = ({ isOpen, onClose, onToggle }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [aiSettings, setAiSettings] = useState({
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 500
  });
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
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          initialMessage: 'Hello, I need help with a question'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      setConversation(data.conversation);
      
      // Add initial bot message
      if (data.conversation.messages && data.conversation.messages.length > 0) {
        setMessages(data.conversation.messages);
      } else {
        setMessages([{
          content: 'Hello! I\'m your AI assistant. How can I help you today?',
          sender: 'bot',
          timestamp: new Date(),
          metadata: {
            confidence: 0.9,
            suggestedActions: [
              { type: 'button', label: 'Ask a Question', value: 'ask_question' },
              { type: 'button', label: 'Get Help', value: 'get_help' },
              { type: 'button', label: 'Knowledge Base', value: 'knowledge_base' }
            ]
          }
        }]);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
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
      const response = await fetch(`/api/chatbot/${conversation._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content,
          messageType: 'text'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setConversation(data.conversation);

      if (data.botResponse) {
        const botMessage = {
          content: data.botResponse.content,
          sender: 'bot',
          timestamp: new Date(),
          metadata: {
            confidence: data.botResponse.confidence,
            suggestedActions: data.botResponse.suggestedActions
          }
        };

        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      }]);
      toast.error('Failed to send message');
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
      case 'ask_question':
        sendMessage('I have a question I need help with.');
        break;
      case 'get_help':
        sendMessage('I need help with something.');
        break;
      case 'knowledge_base':
        window.open('/knowledge-base', '_blank');
        break;
      case 'create_ticket':
        window.location.href = '/create-ticket';
        break;
      case 'check_status':
        window.location.href = '/tickets';
        break;
      default:
        sendMessage(action.label);
    }
  };

  const handleQuickQuestion = (question) => {
    sendMessage(question);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickQuestions = [
    'How do I reset my password?',
    'How do I create a ticket?',
    'What are the system requirements?',
    'How do I check ticket status?',
    'What are the support hours?'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <Brain className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs opacity-90">Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 h-96 overflow-y-auto p-4 space-y-4">
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
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                        <span className="text-xs opacity-75">
                          {Math.round(message.metadata.confidence * 100)}% confidence
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

          {/* Quick Questions */}
          {messages.length === 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-1">
                {quickQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickQuestion(question)}
                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Actions */}
          {messages.length > 0 && messages[messages.length - 1]?.metadata?.suggestedActions && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {messages[messages.length - 1].metadata.suggestedActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedAction(action)}
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full hover:bg-purple-200 transition-colors"
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
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* AI Settings */}
          <div className="px-4 pb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">AI Settings</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600">Active</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Model:</span>
                  <span className="ml-1 text-gray-700">{aiSettings.model}</span>
                </div>
                <div>
                  <span className="text-gray-500">Temp:</span>
                  <span className="ml-1 text-gray-700">{aiSettings.temperature}</span>
                </div>
                <div>
                  <span className="text-gray-500">Tokens:</span>
                  <span className="ml-1 text-gray-700">{aiSettings.maxTokens}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChatbotWidget; 