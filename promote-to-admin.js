const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('./server/models/User');

async function promoteToAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quickdesk', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get command line arguments
    const email = process.argv[2];
    
    if (!email) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node promote-to-admin.js <email>');
      console.log('Example: node promote-to-admin.js user@example.com');
      process.exit(1);
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found with email:', email);
      console.log('Available users:');
      const allUsers = await User.find({}, 'name email role');
      allUsers.forEach(u => {
        console.log(`- ${u.name} (${u.email}) - Role: ${u.role}`);
      });
      process.exit(1);
    }

    // Check if user is already admin
    if (user.role === 'admin') {
      console.log('⚠️  User is already an admin:', user.email);
      process.exit(0);
    }

    // Promote to admin
    user.role = 'admin';
    await user.save();

    console.log('✅ User promoted to admin successfully!');
    console.log('👤 Name:', user.name);
    console.log('📧 Email:', user.email);
    console.log('👑 New Role: Admin');

  } catch (error) {
    console.error('❌ Error promoting user to admin:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
promoteToAdmin(); 