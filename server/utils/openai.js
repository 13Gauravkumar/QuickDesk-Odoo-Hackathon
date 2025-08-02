let openai = null;

// Initialize OpenAI client only if API key is available
if (process.env.OPENAI_API_KEY) {
  const OpenAI = require('openai');
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Enhanced AI search for knowledge base articles
 * @param {string} query - User search query
 * @param {Array} articles - Available knowledge base articles
 * @returns {Promise<Object>} - AI-enhanced search results
 */
const aiSearch = async (query, articles) => {
  try {
    if (!openai || !process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare context from articles
    const articlesContext = articles.map(article => ({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags,
      id: article._id
    })).slice(0, 10); // Limit to top 10 articles for context

    // Create system prompt for AI
    const systemPrompt = `You are a helpful AI assistant for a knowledge base system. Your task is to:
1. Understand the user's query and find the most relevant articles
2. Provide intelligent search suggestions
3. Explain why certain articles are relevant
4. Suggest related topics or questions

Available articles context:
${articlesContext.map(article => `
Title: ${article.title}
Category: ${article.category}
Tags: ${article.tags?.join(', ') || 'None'}
Content: ${article.content.substring(0, 200)}...
`).join('\n')}

Please provide:
1. A relevance score (0-10) for each article
2. A brief explanation of why each article is relevant
3. Additional search suggestions
4. Related topics the user might be interested in`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `User query: "${query}"
          
Please analyze this query against the available knowledge base articles and provide:
1. Relevance scores for each article (0-10)
2. Brief explanations for relevance
3. Additional search suggestions
4. Related topics

Format your response as JSON with the following structure:
{
  "articleScores": [
    {
      "articleId": "id",
      "relevanceScore": 8.5,
      "explanation": "This article is highly relevant because..."
    }
  ],
  "searchSuggestions": ["suggestion1", "suggestion2"],
  "relatedTopics": ["topic1", "topic2"],
  "aiInsights": "Brief AI analysis of the query and results"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Parse AI response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback to basic search
      return fallbackSearch(query, articles);
    }

    // Enhance articles with AI insights
    const enhancedArticles = articles.map(article => {
      const aiScore = parsedResponse.articleScores?.find(score => score.articleId === article._id);
      return {
        ...article,
        aiRelevanceScore: aiScore?.relevanceScore || 0,
        aiExplanation: aiScore?.explanation || '',
        enhancedByAI: true
      };
    });

    // Sort by AI relevance score
    enhancedArticles.sort((a, b) => (b.aiRelevanceScore || 0) - (a.aiRelevanceScore || 0));

    return {
      query,
      results: enhancedArticles.slice(0, 10),
      total: enhancedArticles.length,
      aiInsights: parsedResponse.aiInsights || '',
      searchSuggestions: parsedResponse.searchSuggestions || [],
      relatedTopics: parsedResponse.relatedTopics || [],
      enhancedByAI: true
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to basic search if AI fails
    return fallbackSearch(query, articles);
  }
};

/**
 * Fallback search when AI is not available
 * @param {string} query - User search query
 * @param {Array} articles - Available knowledge base articles
 * @returns {Object} - Basic search results
 */
const fallbackSearch = (query, articles) => {
  const queryLower = query.toLowerCase();
  const searchTerms = queryLower.split(' ').filter(term => term.length > 2);
  
  const results = articles
    .map(article => {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const contentLower = article.content.toLowerCase();
      
      // Title matches get higher scores
      if (titleLower.includes(queryLower)) score += 10;
      
      // Content matches
      if (contentLower.includes(queryLower)) score += 5;
      
      // Individual word matches
      searchTerms.forEach(term => {
        if (titleLower.includes(term)) score += 3;
        if (contentLower.includes(term)) score += 1;
        if (article.tags?.some(tag => tag.toLowerCase().includes(term))) score += 2;
      });
      
      // Boost featured articles
      if (article.featured) score += 2;
      
      // Boost by rating
      score += (article.rating || 0) * 0.5;
      
      return { ...article, relevanceScore: score };
    })
    .filter(article => article.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
  
  return {
    query,
    results,
    total: results.length,
    enhancedByAI: false
  };
};

/**
 * Generate intelligent search suggestions
 * @param {string} query - User search query
 * @param {Array} articles - Available knowledge base articles
 * @returns {Promise<Array>} - AI-generated suggestions
 */
const generateAISuggestions = async (query, articles) => {
  try {
    if (!openai || !process.env.OPENAI_API_KEY) {
      return generateBasicSuggestions(query);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates search suggestions for a knowledge base. Provide 5 relevant search suggestions based on the user's query."
        },
        {
          role: "user",
          content: `Based on the query "${query}", suggest 5 related search terms or questions that users might want to search for. Return only a JSON array of strings.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const response = completion.choices[0].message.content;
    try {
      return JSON.parse(response);
    } catch (parseError) {
      return generateBasicSuggestions(query);
    }
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return generateBasicSuggestions(query);
  }
};

/**
 * Generate basic search suggestions
 * @param {string} query - User search query
 * @returns {Array} - Basic suggestions
 */
const generateBasicSuggestions = (query) => {
  const suggestions = [];
  const queryLower = query.toLowerCase();
  
  // Common search patterns
  const patterns = [
    'how to', 'troubleshoot', 'setup', 'configuration',
    'billing', 'payment', 'account', 'security',
    'login', 'upload', 'download', 'export'
  ];
  
  patterns.forEach(pattern => {
    if (pattern.includes(queryLower) || queryLower.includes(pattern)) {
      suggestions.push(pattern);
    }
  });
  
  return suggestions.slice(0, 5);
};

module.exports = {
  aiSearch,
  generateAISuggestions,
  fallbackSearch
}; 