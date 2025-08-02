const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/knowledge-base/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed!'));
    }
  }
});

// In-memory storage for knowledge base articles (in production, use MongoDB)
let knowledgeBaseArticles = [
  {
    _id: '1',
    title: 'Getting Started with QuickDesk',
    content: `
      <h2>Welcome to QuickDesk</h2>
      <p>QuickDesk is a comprehensive help desk management system designed to streamline your support operations.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Ticket Management:</strong> Create, track, and resolve support tickets efficiently</li>
        <li><strong>Real-time Updates:</strong> Get instant notifications and live updates</li>
        <li><strong>File Attachments:</strong> Support for file uploads in tickets and comments</li>
        <li><strong>Email Notifications:</strong> Automated email notifications for ticket events</li>
        <li><strong>Voting System:</strong> Upvote/downvote tickets for community feedback</li>
        <li><strong>Search & Filtering:</strong> Advanced search and filtering capabilities</li>
        <li><strong>Responsive Design:</strong> Mobile-first, responsive UI</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Register for an account or log in if you already have one</li>
        <li>Create your first support ticket</li>
        <li>Explore the dashboard and analytics</li>
        <li>Set up your profile and preferences</li>
      </ol>
    `,
    category: 'general',
    difficulty: 'beginner',
    tags: ['getting-started', 'introduction', 'features'],
    author: 'QuickDesk Team',
    views: 1250,
    rating: 4.8,
    helpful: 89,
    featured: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    _id: '2',
    title: 'How to Create and Manage Tickets',
    content: `
      <h2>Creating and Managing Tickets</h2>
      <p>Learn how to effectively create and manage support tickets in QuickDesk.</p>
      
      <h3>Creating a New Ticket</h3>
      <ol>
        <li>Navigate to the "Create Ticket" page</li>
        <li>Fill in the required fields:
          <ul>
            <li><strong>Title:</strong> A clear, descriptive title for your issue</li>
            <li><strong>Description:</strong> Detailed explanation of the problem</li>
            <li><strong>Category:</strong> Select the most appropriate category</li>
            <li><strong>Priority:</strong> Choose the urgency level</li>
          </ul>
        </li>
        <li>Attach any relevant files (optional)</li>
        <li>Click "Create Ticket" to submit</li>
      </ol>
      
      <h3>Managing Your Tickets</h3>
      <ul>
        <li><strong>View Status:</strong> Check the current status of your tickets</li>
        <li><strong>Add Comments:</strong> Provide additional information or ask questions</li>
        <li><strong>Upload Files:</strong> Attach screenshots or documents</li>
        <li><strong>Vote:</strong> Upvote or downvote tickets to help prioritize issues</li>
      </ul>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Be specific and detailed in your descriptions</li>
        <li>Include relevant screenshots or error messages</li>
        <li>Choose the appropriate priority level</li>
        <li>Follow up on your tickets regularly</li>
      </ul>
    `,
    category: 'guides',
    difficulty: 'beginner',
    tags: ['tickets', 'create', 'manage', 'best-practices'],
    author: 'Support Team',
    views: 890,
    rating: 4.6,
    helpful: 67,
    featured: false,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-25')
  },
  {
    _id: '3',
    title: 'Troubleshooting Common Issues',
    content: `
      <h2>Common Issues and Solutions</h2>
      <p>This guide covers the most common issues users encounter and their solutions.</p>
      
      <h3>Login Problems</h3>
      <h4>Symptom: Can't log in to the system</h4>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>Check your email and password</li>
        <li>Clear browser cache and cookies</li>
        <li>Try using a different browser</li>
        <li>Reset your password if needed</li>
      </ul>
      
      <h3>File Upload Issues</h3>
      <h4>Symptom: Can't upload files to tickets</h4>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>Check file size (max 5MB)</li>
        <li>Ensure file type is supported</li>
        <li>Try uploading one file at a time</li>
        <li>Check your internet connection</li>
      </ul>
      
      <h3>Performance Issues</h3>
      <h4>Symptom: System is slow or unresponsive</h4>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>Refresh the page</li>
        <li>Clear browser cache</li>
        <li>Check your internet connection</li>
        <li>Try accessing from a different device</li>
      </ul>
    `,
    category: 'troubleshooting',
    difficulty: 'intermediate',
    tags: ['troubleshooting', 'login', 'upload', 'performance'],
    author: 'Technical Support',
    views: 1560,
    rating: 4.7,
    helpful: 134,
    featured: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-30')
  },
  {
    _id: '4',
    title: 'Understanding Ticket Priorities',
    content: `
      <h2>Ticket Priority Levels</h2>
      <p>Understanding how to set the right priority for your tickets helps ensure timely resolution.</p>
      
      <h3>Priority Levels</h3>
      
      <h4>🔴 Urgent</h4>
      <ul>
        <li>System completely down or inaccessible</li>
        <li>Security vulnerabilities</li>
        <li>Data loss or corruption</li>
        <li>Critical business impact</li>
      </ul>
      <p><strong>Response Time:</strong> Within 1 hour</p>
      
      <h4>🟠 High</h4>
      <ul>
        <li>Major functionality broken</li>
        <li>Significant performance issues</li>
        <li>Multiple users affected</li>
        <li>Important business process blocked</li>
      </ul>
      <p><strong>Response Time:</strong> Within 4 hours</p>
      
      <h4>🔵 Medium</h4>
      <ul>
        <li>Minor functionality issues</li>
        <li>Feature requests</li>
        <li>General questions</li>
        <li>Non-critical bugs</li>
      </ul>
      <p><strong>Response Time:</strong> Within 24 hours</p>
      
      <h4>⚪ Low</h4>
      <ul>
        <li>Documentation requests</li>
        <li>Enhancement suggestions</li>
        <li>General inquiries</li>
        <li>Non-urgent questions</li>
      </ul>
      <p><strong>Response Time:</strong> Within 72 hours</p>
    `,
    category: 'general',
    difficulty: 'beginner',
    tags: ['priority', 'urgent', 'high', 'medium', 'low'],
    author: 'Support Team',
    views: 720,
    rating: 4.5,
    helpful: 45,
    featured: false,
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18')
  },
  {
    _id: '5',
    title: 'Advanced Analytics and Reporting',
    content: `
      <h2>Analytics and Reporting Features</h2>
      <p>Learn how to use QuickDesk's advanced analytics and reporting capabilities.</p>
      
      <h3>Dashboard Overview</h3>
      <p>The analytics dashboard provides comprehensive insights into your support operations:</p>
      <ul>
        <li><strong>Ticket Volume:</strong> Track ticket creation trends</li>
        <li><strong>Response Times:</strong> Monitor average response and resolution times</li>
        <li><strong>SLA Compliance:</strong> Track service level agreement adherence</li>
        <li><strong>User Activity:</strong> Monitor user engagement and activity</li>
      </ul>
      
      <h3>Exporting Reports</h3>
      <p>Generate detailed reports in multiple formats:</p>
      <ul>
        <li><strong>CSV Export:</strong> For data analysis in Excel or other tools</li>
        <li><strong>PDF Reports:</strong> For presentations and documentation</li>
        <li><strong>Custom Date Ranges:</strong> Analyze specific time periods</li>
        <li><strong>Filtered Data:</strong> Focus on specific categories or priorities</li>
      </ul>
      
      <h3>Key Metrics</h3>
      <ul>
        <li><strong>First Response Time:</strong> Time to first agent response</li>
        <li><strong>Resolution Time:</strong> Time to ticket closure</li>
        <li><strong>Customer Satisfaction:</strong> Based on ratings and feedback</li>
        <li><strong>Agent Performance:</strong> Individual agent metrics</li>
      </ul>
    `,
    category: 'technical',
    difficulty: 'advanced',
    tags: ['analytics', 'reporting', 'metrics', 'dashboard'],
    author: 'Analytics Team',
    views: 450,
    rating: 4.9,
    helpful: 78,
    featured: false,
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-28')
  }
];

// Get all knowledge base articles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, sortBy = 'date', limit = 50 } = req.query;
    
    let filteredArticles = [...knowledgeBaseArticles];
    
    // Filter by category
    if (category) {
      filteredArticles = filteredArticles.filter(article => article.category === category);
    }
    
    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filteredArticles = filteredArticles.filter(article =>
        article.title.toLowerCase().includes(searchLower) ||
        article.content.toLowerCase().includes(searchLower) ||
        article.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort articles
    switch (sortBy) {
      case 'date':
        filteredArticles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'views':
        filteredArticles.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'rating':
        filteredArticles.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'helpful':
        filteredArticles.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
        break;
      default:
        filteredArticles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Apply limit
    if (limit) {
      filteredArticles = filteredArticles.slice(0, parseInt(limit));
    }
    
    res.json({
      articles: filteredArticles,
      total: filteredArticles.length,
      categories: [...new Set(knowledgeBaseArticles.map(article => article.category))]
    });
  } catch (error) {
    console.error('Error fetching knowledge base articles:', error);
    res.status(500).json({ message: 'Error fetching articles' });
  }
});

// Get single article
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const article = knowledgeBaseArticles.find(a => a._id === req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    // Increment view count
    article.views = (article.views || 0) + 1;
    
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ message: 'Error fetching article' });
  }
});

// AI-powered search
router.post('/ai-search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    // Simple AI-like search implementation
    const queryLower = query.toLowerCase();
    const searchTerms = queryLower.split(' ').filter(term => term.length > 2);
    
    const results = knowledgeBaseArticles
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
    
    res.json({
      query,
      results,
      total: results.length,
      suggestions: generateSearchSuggestions(query)
    });
  } catch (error) {
    console.error('AI search error:', error);
    res.status(500).json({ message: 'Error performing AI search' });
  }
});

// Generate search suggestions
const generateSearchSuggestions = (query) => {
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
      suggestions.push({
        type: 'pattern',
        text: `Search for "${pattern}"`,
        query: pattern
      });
    }
  });
  
  // Category suggestions
  const categories = ['general', 'technical', 'billing', 'troubleshooting', 'guides'];
  categories.forEach(category => {
    if (category.includes(queryLower)) {
      suggestions.push({
        type: 'category',
        text: `Browse ${category} articles`,
        query: `category:${category}`
      });
    }
  });
  
  return suggestions.slice(0, 5);
};

// Create new article (admin/agent only)
router.post('/', authenticateToken, authorize(['admin', 'agent']), upload.single('image'), async (req, res) => {
  try {
    const { title, content, category, difficulty, tags } = req.body;
    
    if (!title || !content || !category) {
      return res.status(400).json({ message: 'Title, content, and category are required' });
    }
    
    const newArticle = {
      _id: Date.now().toString(),
      title,
      content,
      category,
      difficulty: difficulty || 'beginner',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      author: req.user.name,
      views: 0,
      rating: 0,
      helpful: 0,
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (req.file) {
      newArticle.image = `/uploads/knowledge-base/${req.file.filename}`;
    }
    
    knowledgeBaseArticles.push(newArticle);
    
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ message: 'Error creating article' });
  }
});

// Update article (admin/agent only)
router.put('/:id', authenticateToken, authorize(['admin', 'agent']), async (req, res) => {
  try {
    const { title, content, category, difficulty, tags, featured } = req.body;
    
    const articleIndex = knowledgeBaseArticles.findIndex(a => a._id === req.params.id);
    
    if (articleIndex === -1) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    const updatedArticle = {
      ...knowledgeBaseArticles[articleIndex],
      title: title || knowledgeBaseArticles[articleIndex].title,
      content: content || knowledgeBaseArticles[articleIndex].content,
      category: category || knowledgeBaseArticles[articleIndex].category,
      difficulty: difficulty || knowledgeBaseArticles[articleIndex].difficulty,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : knowledgeBaseArticles[articleIndex].tags,
      featured: featured !== undefined ? featured : knowledgeBaseArticles[articleIndex].featured,
      updatedAt: new Date()
    };
    
    knowledgeBaseArticles[articleIndex] = updatedArticle;
    
    res.json(updatedArticle);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ message: 'Error updating article' });
  }
});

// Delete article (admin only)
router.delete('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const articleIndex = knowledgeBaseArticles.findIndex(a => a._id === req.params.id);
    
    if (articleIndex === -1) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    knowledgeBaseArticles.splice(articleIndex, 1);
    
    res.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ message: 'Error deleting article' });
  }
});

// Rate article helpfulness
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { helpful } = req.body;
    const article = knowledgeBaseArticles.find(a => a._id === req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    
    if (helpful) {
      article.helpful = (article.helpful || 0) + 1;
    }
    
    res.json({ message: 'Rating recorded successfully' });
  } catch (error) {
    console.error('Error rating article:', error);
    res.status(500).json({ message: 'Error rating article' });
  }
});

module.exports = router; 