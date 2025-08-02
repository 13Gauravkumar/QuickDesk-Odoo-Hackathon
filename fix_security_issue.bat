@echo off
echo Fixing GitHub Security Issue - Removing Sensitive Data from Git History
echo.

echo Step 1: Removing OPENAI_SETUP.md from git tracking...
git rm --cached OPENAI_SETUP.md

echo Step 2: Adding OPENAI_SETUP.md to .gitignore...
echo # Documentation with sensitive information >> .gitignore
echo OPENAI_SETUP.md >> .gitignore

echo Step 3: Committing the changes...
git add .gitignore
git commit -m "security: remove sensitive documentation from tracking"

echo Step 4: Force pushing to overwrite remote history...
git push --force-with-lease origin main

echo.
echo Security fix completed!
echo The OPENAI_SETUP.md file has been removed from git tracking.
echo Please ensure you never commit actual API keys to version control.
echo.
pause 