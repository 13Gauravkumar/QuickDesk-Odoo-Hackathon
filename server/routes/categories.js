const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const Category = require('../models/Category');

// Get all categories (public access)
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ name: 1 });
    
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create category (admin only)
router.post('/', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const category = new Category({
      name,
      description,
      color,
      createdBy: req.user.id
    });
    
    await category.save();
    
    // Emit real-time event
    const emitToAll = req.app.get('emitToAll');
    emitToAll('category:created', { category: { id: category._id, name: category.name, color: category.color } });
    
    res.status(201).json({ category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update category (admin only)
router.patch('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, description, color, isActive } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (color) updateData.color = color;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Emit real-time event
    const emitToAll = req.app.get('emitToAll');
    emitToAll('category:updated', { category: { id: category._id, name: category.name, color: category.color } });
    
    res.json({ category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 