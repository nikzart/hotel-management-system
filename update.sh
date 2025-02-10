#!/bin/bash

# Exit on error
set -e

# Configuration
APP_DIR="/var/www/hotel-system"
LOG_DIR="/var/log/hotel-system"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Check if application directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "Error: Application directory not found. Please run deploy.sh first."
    exit 1
fi

# Print status message
echo "Starting update process..."

# Ensure log directory exists with proper permissions
echo "Checking log directory..."
mkdir -p $LOG_DIR
chown -R $SUDO_USER:$SUDO_USER $LOG_DIR

# Navigate to app directory and update as the correct user
echo "Pulling latest changes..."
su - $SUDO_USER -c "cd $APP_DIR && git stash && git pull origin main"

# Install dependencies as the correct user
echo "Updating dependencies..."
su - $SUDO_USER -c "cd $APP_DIR && npm install --production"

# Restart the services
echo "Restarting services..."
systemctl restart hotel-system
systemctl restart nginx

echo "Update completed successfully!"
echo "Check application status with: systemctl status hotel-system"
echo "Check nginx status with: systemctl status nginx"
echo "View logs with: tail -f $LOG_DIR/app.log"