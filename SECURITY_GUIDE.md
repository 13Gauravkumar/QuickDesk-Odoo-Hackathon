# Security Guide - Preventing API Key Exposure

## Overview
This guide ensures that sensitive information like API keys are never exposed in your codebase or git history.

## Current Security Measures

### 1. Environment Variables
All sensitive data is stored in environment variables:
- API keys are in `.env` files
- `.env` files are in `.gitignore`
- Only `.env.example` is committed (with placeholder values)

### 2. Git Configuration
- `.gitignore` includes sensitive files
- `OPENAI_SETUP.md` is excluded from tracking
- Environment files are properly ignored

### 3. Code Practices
- All code uses `process.env.VARIABLE_NAME`
- No hardcoded secrets in source code
- Proper error handling without exposing sensitive data

## Best Practices

### 1. Environment Variables
```bash
# ✅ Correct - Use environment variables
OPENAI_API_KEY=your_actual_key_here

# ❌ Wrong - Never hardcode in source
const apiKey = "sk-your-actual-key";
```

### 2. Git Safety
```bash
# ✅ Always check before committing
git status
git diff --cached

# ❌ Never commit .env files
git add .env  # This should fail due to .gitignore
```

### 3. File Naming
- Use `.env.example` for templates
- Use `.env` for actual values
- Never commit `.env` files

## Security Checklist

### Before Every Commit
- [ ] Check `git status` for sensitive files
- [ ] Verify no API keys in staged changes
- [ ] Ensure `.env` files are not tracked
- [ ] Review commit message for sensitive info

### Before Every Push
- [ ] Run `git log --oneline -5` to review recent commits
- [ ] Check for any sensitive data in commit messages
- [ ] Verify remote repository settings

### Environment Setup
- [ ] Copy `.env.example` to `.env`
- [ ] Replace placeholder values with real keys
- [ ] Never commit the `.env` file
- [ ] Use different keys for dev/prod

## Troubleshooting

### If You Accidentally Commit Sensitive Data
1. **Immediate Action**:
   ```bash
   git reset --soft HEAD~1  # Undo last commit
   git reset HEAD .env      # Unstage sensitive files
   ```

2. **Remove from History**:
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch .env" \
   --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force Push**:
   ```bash
   git push --force-with-lease origin main
   ```

### If GitHub Blocks Push
1. Check the error message for specific files
2. Remove sensitive data from those files
3. Use `git filter-branch` to clean history
4. Force push with `--force-with-lease`

## File Structure
```
project/
├── .env.example          # ✅ Safe to commit (templates)
├── .env                  # ❌ Never commit (actual values)
├── .gitignore           # ✅ Safe to commit
├── src/
│   └── config.js        # ✅ Safe (uses process.env)
└── README.md            # ✅ Safe (no real keys)
```

## Common Mistakes to Avoid

### 1. Hardcoding Secrets
```javascript
// ❌ Never do this
const config = {
  apiKey: "sk-your-actual-key-here"
};

// ✅ Always do this
const config = {
  apiKey: process.env.OPENAI_API_KEY
};
```

### 2. Committing .env Files
```bash
# ❌ Never do this
git add .env
git commit -m "Add API key"

# ✅ Always do this
git add .env.example
git commit -m "Add environment template"
```

### 3. Exposing in Logs
```javascript
// ❌ Never do this
console.log("API Key:", process.env.OPENAI_API_KEY);

// ✅ Always do this
console.log("API Key configured:", !!process.env.OPENAI_API_KEY);
```

## Emergency Contacts
If you accidentally expose sensitive data:
1. Immediately revoke the exposed API key
2. Generate a new API key
3. Update your `.env` file
4. Clean git history as described above

## Monitoring
- Use GitHub's secret scanning feature
- Enable branch protection rules
- Set up automated security checks
- Regular security audits

---

**Remember**: Security is everyone's responsibility. When in doubt, ask before committing sensitive data. 