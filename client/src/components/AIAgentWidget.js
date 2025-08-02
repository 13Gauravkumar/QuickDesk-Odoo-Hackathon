import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bot, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  BookOpen,
  MessageSquare,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const AIAgentWidget = ({ ticket, onUpdate }) => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userMessage, setUserMessage] = useState('');

  // Analyze ticket with AI agent
  const analyzeTicket = async () => {
    if (!ticket) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(`/api/ai-agent/analyze/${ticket._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to analyze ticket');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      toast.success('AI analysis completed!');
    } catch (error) {
      console.error('Error analyzing ticket:', error);
      toast.error('Failed to analyze ticket');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-resolve ticket with AI agent
  const autoResolveTicket = async () => {
    if (!ticket) return;

    setIsResolving(true);
    try {
      const response = await fetch(`/api/ai-agent/resolve/${ticket._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to auto-resolve ticket');
      }

      const data = await response.json();
      
      if (data.response.resolutionResult.success) {
        toast.success('Ticket auto-resolved by AI agent!');
        onUpdate && onUpdate();
      } else {
        toast.info('Ticket requires human agent assistance');
      }
      
      setAnalysis(data.response.analysis);
    } catch (error) {
      console.error('Error auto-resolving ticket:', error);
      toast.error('Failed to auto-resolve ticket');
    } finally {
      setIsResolving(false);
    }
  };

  // Get AI response suggestions
  const getResponseSuggestions = async () => {
    if (!ticket || !userMessage.trim()) return;

    try {
      const response = await fetch(`/api/ai-agent/suggest-response/${ticket._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ userMessage })
      });

      if (!response.ok) {
        throw new Error('Failed to get response suggestions');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error getting response suggestions:', error);
      toast.error('Failed to get response suggestions');
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get confidence icon
  const getConfidenceIcon = (confidence) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Agent Assistant
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Powered by AI</span>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 dark:text-white">AI Analysis</h4>
            <div className={`flex items-center space-x-1 ${getConfidenceColor(analysis.analysis.confidence)}`}>
              {getConfidenceIcon(analysis.analysis.confidence)}
              <span className="text-sm font-medium">
                {Math.round(analysis.analysis.confidence * 100)}% confidence
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Issue Type:</span>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                {analysis.analysis.issueType}
              </span>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Can Auto-Resolve:</span>
              <span className={`ml-2 text-sm ${analysis.analysis.canAutoResolve ? 'text-green-600' : 'text-red-600'}`}>
                {analysis.analysis.canAutoResolve ? 'Yes' : 'No'}
              </span>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estimated Time:</span>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {analysis.analysis.estimatedResolutionTime}
              </span>
            </div>

            {analysis.response.resolutionSteps && (
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resolution Steps:</span>
                <ol className="mt-1 ml-4 list-decimal text-sm text-gray-600 dark:text-gray-400">
                  {analysis.response.resolutionSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!analysis && (
          <button
            onClick={analyzeTicket}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                <span>Analyze with AI</span>
              </>
            )}
          </button>
        )}

        {analysis && analysis.analysis.canAutoResolve && (
          <button
            onClick={autoResolveTicket}
            disabled={isResolving}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isResolving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Resolving...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Auto-Resolve Ticket</span>
              </>
            )}
          </button>
        )}

        {analysis && (
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Get Response Suggestions</span>
          </button>
        )}
      </div>

      {/* Response Suggestions */}
      {showSuggestions && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Response Suggestions</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Message:
              </label>
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                placeholder="Enter your message to get AI suggestions..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                rows="3"
              />
            </div>

            <button
              onClick={getResponseSuggestions}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Get Suggestions</span>
            </button>

            {analysis?.response?.message && (
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">Suggested Response:</h5>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {analysis.response.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Knowledge Base Articles */}
      {analysis?.response?.suggestedArticles && analysis.response.suggestedArticles.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <BookOpen className="w-4 h-4 text-yellow-600" />
            <h4 className="font-medium text-gray-900 dark:text-white">Related Articles</h4>
          </div>
          <div className="space-y-2">
            {analysis.response.suggestedArticles.map((article, index) => (
              <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                • {article.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      {analysis?.response?.nextActions && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <Clock className="w-4 h-4 text-green-600" />
            <h4 className="font-medium text-gray-900 dark:text-white">Recommended Actions</h4>
          </div>
          <div className="space-y-2">
            {analysis.response.nextActions.map((action, index) => (
              <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                • {action}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentWidget; 