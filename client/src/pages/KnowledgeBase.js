import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { 
  Search, 
  BookOpen, 
  HelpCircle, 
  FileText, 
  Plus,
  Edit,
  Trash2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Filter,
  Tag,
  Sparkles,
  TrendingUp,
  Clock,
  Star,
  Bookmark,
  Lightbulb,
  Zap,
  Brain
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [aiSearch, setAiSearch] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    sortBy: 'relevance',
    dateRange: 'all',
    difficulty: 'all',
    tags: []
  });
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [aiInsights, setAiInsights] = useState('');
  const [relatedTopics, setRelatedTopics] = useState([]);

  // Fetch knowledge base articles
  const { data: articles, isLoading } = useQuery('knowledge-base', async () => {
    const response = await fetch('/api/knowledge-base', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.json();
  });

  // AI-powered search suggestions
  useEffect(() => {
    if (search.length > 2) {
      const suggestions = generateSearchSuggestions(search, articles?.articles || []);
      setSearchSuggestions(suggestions);
    } else {
      setSearchSuggestions([]);
    }
  }, [search, articles]);

  // Real-time updates
  useEffect(() => {
    if (socket && socket.on) {
      // Knowledge base events
      socket.on('knowledge:article_viewed', (data) => {
        console.log(`Article viewed: ${data.title}`);
        // Optionally update view count in real-time
      });

      socket.on('knowledge:article_rated', (data) => {
        queryClient.invalidateQueries(['knowledge-base']);
        console.log(`Article rated: ${data.title}`);
      });

      return () => {
        if (socket && socket.off) {
          socket.off('knowledge:article_viewed');
          socket.off('knowledge:article_rated');
        }
      };
    }
  }, [socket, queryClient]);

  const generateSearchSuggestions = (query, articles) => {
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    // Find articles with similar titles or content
    articles.forEach(article => {
      if (article.title.toLowerCase().includes(queryLower) ||
          article.content.toLowerCase().includes(queryLower)) {
        suggestions.push({
          type: 'article',
          title: article.title,
          id: article._id,
          relevance: calculateRelevance(query, article)
        });
      }
    });

    // Add common search terms
    const commonTerms = [
      'how to', 'troubleshoot', 'setup', 'configuration',
      'billing', 'payment', 'account', 'security'
    ];

    commonTerms.forEach(term => {
      if (term.includes(queryLower)) {
        suggestions.push({
          type: 'suggestion',
          title: `Search for "${term}"`,
          query: term
        });
      }
    });

    return suggestions.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  };

  const calculateRelevance = (query, article) => {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    if (article.title.toLowerCase().includes(queryLower)) score += 10;
    if (article.content.toLowerCase().includes(queryLower)) score += 5;
    if (article.tags?.some(tag => tag.toLowerCase().includes(queryLower))) score += 3;
    
    return score;
  };

  const categories = [
    { id: 'general', name: 'General', color: 'bg-blue-100 text-blue-800', icon: BookOpen },
    { id: 'technical', name: 'Technical', color: 'bg-green-100 text-green-800', icon: FileText },
    { id: 'billing', name: 'Billing', color: 'bg-purple-100 text-purple-800', icon: HelpCircle },
    { id: 'faq', name: 'FAQ', color: 'bg-orange-100 text-orange-800', icon: HelpCircle },
    { id: 'troubleshooting', name: 'Troubleshooting', color: 'bg-red-100 text-red-800', icon: Zap },
    { id: 'guides', name: 'Guides', color: 'bg-indigo-100 text-indigo-800', icon: BookOpen }
  ];

  const filteredArticles = articles?.articles?.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(search.toLowerCase()) ||
                         article.content.toLowerCase().includes(search.toLowerCase()) ||
                         article.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !category || article.category === category;
    const matchesDifficulty = filterOptions.difficulty === 'all' || article.difficulty === filterOptions.difficulty;
    const matchesTags = filterOptions.tags.length === 0 || 
                       filterOptions.tags.some(tag => article.tags?.includes(tag));
    
    return matchesSearch && matchesCategory && matchesDifficulty && matchesTags;
  }) || [];

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (filterOptions.sortBy) {
      case 'relevance':
        return calculateRelevance(search, b) - calculateRelevance(search, a);
      case 'date':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'views':
        return (b.views || 0) - (a.views || 0);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || 'bg-gray-100 text-gray-800';
  };

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
  };

  const handleAiSearch = async () => {
    if (!search.trim()) return;
    
    setAiSearch(true);
    setAiSearchResults(null);
    setAiInsights('');
    setRelatedTopics([]);
    
    try {
      const response = await fetch('/api/knowledge-base/ai-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ query: search })
      });
      
      const result = await response.json();
      
      if (result.enhancedByAI) {
        setAiSearchResults(result.results);
        setAiInsights(result.aiInsights || '');
        setRelatedTopics(result.relatedTopics || []);
      } else {
        // Fallback to basic search results
        setAiSearchResults(result.results);
      }
      
      console.log('AI search results:', result);
    } catch (error) {
      console.error('AI search error:', error);
    } finally {
      setAiSearch(false);
    }
  };

  const getPopularTags = () => {
    const tagCounts = {};
    articles?.articles?.forEach(article => {
      article.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
            <p className="text-gray-600">
              Find answers to common questions and helpful resources with AI-powered search.
            </p>
          </div>
          {(user?.role === 'admin' || user?.role === 'agent') && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Article</span>
            </button>
          )}
        </div>
      </div>

      {/* AI-Powered Search */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Ask anything... AI will help you find the best answers"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Clear AI results when user starts typing
                  if (aiSearchResults) {
                    setAiSearchResults(null);
                    setAiInsights('');
                    setRelatedTopics([]);
                  }
                }}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAiSearch}
                disabled={aiSearch || !search.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-blue-100 disabled:opacity-50"
                title="AI Search"
              >
                <Brain className="w-4 h-4 text-blue-600" />
              </button>
            </div>
            
            {/* Search Suggestions */}
            {searchSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => {
                      if (suggestion.type === 'article') {
                        handleArticleClick(suggestion);
                      } else {
                        setSearch(suggestion.query);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      {suggestion.type === 'article' ? (
                        <FileText className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      )}
                      <span className="text-sm">{suggestion.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filterOptions.sortBy}
            onChange={(e) => setFilterOptions(prev => ({ ...prev, sortBy: e.target.value }))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="views">Most Viewed</option>
            <option value="rating">Highest Rated</option>
          </select>
          
          <select
            value={filterOptions.difficulty}
            onChange={(e) => setFilterOptions(prev => ({ ...prev, difficulty: e.target.value }))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Popular Tags */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Popular Tags:</h3>
        <div className="flex flex-wrap gap-2">
          {getPopularTags().map(tag => (
            <button
              key={tag}
              onClick={() => setFilterOptions(prev => ({
                ...prev,
                tags: prev.tags.includes(tag) 
                  ? prev.tags.filter(t => t !== tag)
                  : [...prev.tags, tag]
              }))}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterOptions.tags.includes(tag)
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* AI Search Results */}
      {aiSearchResults && (
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center space-x-2 mb-4">
              <Brain className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">AI-Enhanced Search Results</h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">AI Powered</span>
            </div>
            
            {aiInsights && (
              <div className="mb-4 p-4 bg-white rounded-lg border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-2">AI Insights</h4>
                <p className="text-gray-700 text-sm">{aiInsights}</p>
              </div>
            )}
            
            {relatedTopics.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Related Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {relatedTopics.map((topic, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiSearchResults.map(article => (
              <div
                key={article._id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer relative"
                onClick={() => handleArticleClick(article)}
              >
                {article.enhancedByAI && (
                  <div className="absolute top-2 right-2">
                    <Brain className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category)}`}>
                    {categories.find(c => c.id === article.category)?.name || article.category}
                  </span>
                  <div className="flex items-center space-x-1 text-gray-500">
                    <Eye className="w-3 h-3" />
                    <span className="text-xs">{article.views || 0}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {article.title}
                </h3>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {article.content}
                </p>
                
                {article.aiExplanation && (
                  <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    <strong>AI Analysis:</strong> {article.aiExplanation}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span className="text-xs text-gray-600">{article.rating || 0}</span>
                    {article.aiRelevanceScore && (
                      <span className="text-xs text-blue-600 font-medium">
                        AI Score: {article.aiRelevanceScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(article.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {article.tags && article.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {article.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                    {article.tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{article.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular Articles Grid */}
      {!aiSearchResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedArticles.map(article => (
            <div
              key={article._id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleArticleClick(article)}
            >
              <div className="flex items-start justify-between mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category)}`}>
                  {categories.find(c => c.id === article.category)?.name || article.category}
                </span>
                <div className="flex items-center space-x-1 text-gray-500">
                  <Eye className="w-3 h-3" />
                  <span className="text-xs">{article.views || 0}</span>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {article.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {article.content}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Star className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs text-gray-600">{article.rating || 0}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(article.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              
              {article.tags && article.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {article.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      +{article.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Article Modal */}
      {showArticleModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedArticle.title}</h2>
                <button
                  onClick={() => setShowArticleModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-600">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm">Helpful</span>
                    </button>
                    <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-600">
                      <Share2 className="w-4 h-4" />
                      <span className="text-sm">Share</span>
                    </button>
                    <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-600">
                      <Bookmark className="w-4 h-4" />
                      <span className="text-sm">Bookmark</span>
                    </button>
                  </div>
                  
                  <span className="text-sm text-gray-500">
                    Last updated {format(new Date(selectedArticle.updatedAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!isLoading && sortedArticles.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or browse all articles.</p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase; 