#!/usr/bin/env bash

# Exit on any error
set -e

# Check if package.json exists
if [ -f "package.json" ]; then
    echo "package.json found. Running yarn..."
    yarn
else
    echo "No package.json found. Skipping yarn."
fi

yarn add -g typescript -y
tsc --init .

# Run Wrangler build
echo "Running npx wrangler build..."
npx wrangler build

# Git add, commit, push
echo "Adding changes to git..."
git add .

# You can customize the commit message here
COMMIT_MSG="Automated build commit $(date +'%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG"

echo "Pushing to remote..."
git push

echo "Build and push complete."