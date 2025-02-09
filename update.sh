#!/bin/bash

# Exit on error
set -e

# Configuration
APP_DIR="/var/www/hotel-system"

# Check if application directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "Error: Application directory not found. Please run deploy.sh first."
    exit 1
fi

# Print status message
echo "Starting update process..."

# Navigate to app directory
cd $APP_DIR

# Stash any local changes
echo "Stashing any local changes..."
git stash

# Pull latest changes
echo "Pulling latest changes from main branch..."
git pull origin main

# Install dependencies
echo "Updating dependencies..."
npm install --production

# Restart the service
echo "Restarting service..."
sudo systemctl restart hotel-system

echo "Update completed successfully!"
echo "Check status with: sudo systemctl status hotel-system"