# OpenAI API Integration Setup

## Overview
The QuickDesk Knowledge Base now includes AI-powered search functionality using OpenAI's GPT-3.5-turbo model. This enhancement provides intelligent search results, relevance scoring, and AI-generated insights.

## Setup Instructions

### 1. Environment Configuration
Create a `.env` file in the root directory with the following content:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/quickdesk

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Client URL
CLIENT_URL=http://localhost:3000

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Dependencies
The OpenAI package has been added to the project dependencies. Run:
```bash
npm install
```

### 3. Features Added

#### AI-Powered Search
- **Intelligent Relevance Scoring**: Articles are scored based on AI analysis of content relevance
- **AI-Generated Insights**: Provides explanations for why articles are relevant to the search query
- **Related Topics**: Suggests additional topics users might be interested in
- **Enhanced Search Results**: Displays AI-enhanced results with relevance scores and explanations

#### New API Endpoints
- `POST /api/knowledge-base/ai-search` - AI-powered search
- `POST /api/knowledge-base/ai-suggestions` - AI-generated search suggestions

#### Frontend Enhancements
- AI search button with brain icon
- AI-enhanced results display with insights
- Related topics suggestions
- AI relevance scores for each article
- Fallback to basic search if AI is unavailable

### 4. Usage

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Navigate to Knowledge Base**:
   - Go to the Knowledge Base section
   - Use the search bar with the brain icon for AI-powered search

3. **AI Search Features**:
   - Type your query in the search bar
   - Click the brain icon or press Enter
   - View AI-enhanced results with insights and relevance scores
   - Explore related topics and suggestions

### 5. Technical Implementation

#### Server-Side (`server/utils/openai.js`)
- OpenAI client initialization
- AI search function with context-aware prompts
- Fallback search when AI is unavailable
- Intelligent suggestion generation

#### Client-Side (`client/src/pages/KnowledgeBase.js`)
- Enhanced search interface with AI indicators
- AI results display with insights
- Real-time search suggestions
- Responsive design for AI-enhanced features

### 6. Error Handling
- Graceful fallback to basic search if OpenAI API is unavailable
- Error logging for debugging
- User-friendly error messages
- Rate limiting and API key validation

### 7. Security Considerations
- API key stored in environment variables
- Request validation and sanitization
- Rate limiting on AI endpoints
- Secure error handling without exposing sensitive data

## Testing the Integration

1. **Basic Search**: Try searching for common terms like "tickets", "billing", "troubleshooting"
2. **AI Insights**: Look for the AI analysis section in search results
3. **Related Topics**: Check for suggested related topics
4. **Relevance Scores**: Notice the AI relevance scores on articles

## Troubleshooting

### Common Issues

1. **API Key Not Found**:
   - Ensure the `.env` file exists in the root directory
   - Verify the `OPENAI_API_KEY` is correctly set
   - Restart the server after adding the environment variable

2. **AI Search Not Working**:
   - Check server logs for OpenAI API errors
   - Verify internet connectivity
   - Ensure the API key is valid and has sufficient credits

3. **Fallback to Basic Search**:
   - This is normal behavior when AI is unavailable
   - Check console logs for specific error messages
   - Verify OpenAI service status

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your `.env` file.

## Performance Considerations

- AI search requests are cached to reduce API calls
- Fallback search ensures functionality even without AI
- Rate limiting prevents API abuse
- Efficient context preparation for AI prompts

## Future Enhancements

- **Caching**: Implement Redis caching for AI search results
- **User Feedback**: Collect user feedback on AI search quality
- **Custom Models**: Support for fine-tuned models
- **Multi-language**: Support for multiple languages in AI search
- **Analytics**: Track AI search usage and effectiveness

---

**Note**: The OpenAI API key provided is for demonstration purposes. For production use, please use your own API key and ensure proper security measures are in place. 