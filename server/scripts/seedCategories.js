const mongoose = require('mongoose');
const Category = require('../models/Category');
require('dotenv').config();

const defaultCategories = [
  {
    name: 'Technical Support',
    description: 'Technical issues and troubleshooting',
    color: '#3B82F6',
    createdBy: '000000000000000000000001' // Default admin ID
  },
  {
    name: 'Billing & Payments',
    description: 'Billing inquiries and payment issues',
    color: '#10B981',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'General Inquiry',
    description: 'General questions and information requests',
    color: '#F59E0B',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'Bug Report',
    description: 'Software bugs and issues',
    color: '#EF4444',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'Feature Request',
    description: 'New feature suggestions and requests',
    color: '#8B5CF6',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'Account Issues',
    description: 'Account-related problems and access issues',
    color: '#06B6D4',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'Product Support',
    description: 'Product-specific questions and support',
    color: '#84CC16',
    createdBy: '000000000000000000000001'
  },
  {
    name: 'Integration',
    description: 'API and integration questions',
    color: '#F97316',
    createdBy: '000000000000000000000001'
  }
];

const seedCategories = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Insert default categories
    const categories = await Category.insertMany(defaultCategories);
    console.log(`Successfully seeded ${categories.length} categories:`);
    
    categories.forEach(category => {
      console.log(`- ${category.name} (${category.color})`);
    });

    console.log('Category seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories(); 