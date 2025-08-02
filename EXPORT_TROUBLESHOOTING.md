# Export Functionality Troubleshooting Guide

## Issue: "Failed to export data"

### Common Causes and Solutions

#### 1. **Authentication Issues**
- **Problem**: You're not logged in or your session has expired
- **Solution**: 
  - Log in to your account
  - If you're already logged in, try logging out and logging back in
  - Check that you're using the correct credentials

#### 2. **Permission Issues**
- **Problem**: Your user role doesn't have permission to export data
- **Solution**:
  - Contact your administrator to grant export permissions
  - For analytics exports, you need 'admin' or 'agent' role
  - For user data exports, you can only export your own data

#### 3. **Server Connection Issues**
- **Problem**: The server is not running or not accessible
- **Solution**:
  - Ensure the server is running on port 5000
  - Check that the client is running on port 3000
  - Verify your internet connection

#### 4. **Database Issues**
- **Problem**: Database connection problems
- **Solution**:
  - Ensure MongoDB is running
  - Check that the database contains the required data
  - Verify environment variables are set correctly

### How to Test Export Functionality

1. **Check if you're logged in**:
   - Open browser developer tools (F12)
   - Go to Application/Storage tab
   - Check if there's a 'token' in localStorage

2. **Test the export manually**:
   - Open browser developer tools
   - Go to Console tab
   - Run this command:
   ```javascript
   fetch('/api/users/export?format=json', {
     headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
   }).then(r => r.json()).then(console.log)
   ```

3. **Check server logs**:
   - Look for any error messages in the server console
   - Common errors include database connection issues or missing environment variables

### Environment Setup

Make sure these environment variables are set:
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/quickdesk
PORT=5000
```

### Recent Improvements

The export functionality has been improved with:
- Better error messages that tell you exactly what went wrong
- Automatic session expiration handling
- Permission checking with clear feedback
- Token validation before making requests

### Still Having Issues?

If you're still experiencing problems:
1. Check the browser console for error messages
2. Check the server console for error messages
3. Ensure you're logged in with a valid account
4. Try refreshing the page and logging in again 