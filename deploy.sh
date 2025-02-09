#!/bin/bash

# Exit on error
set -e

# Configuration
REPO_URL="https://github.com/nikzart/hotel-management-system.git"
APP_DIR="/var/www/hotel-system"
NODE_ENV="production"

# Print status message
echo "Starting deployment..."

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    echo "Creating application directory..."
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    # Clone repository
    echo "Cloning repository..."
    git clone $REPO_URL $APP_DIR
else
    # Pull latest changes
    echo "Pulling latest changes..."
    cd $APP_DIR
    git pull origin main
fi

# Install dependencies
echo "Installing dependencies..."
cd $APP_DIR
npm install --production

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please update the .env file with your configuration"
fi

# Create systemd service file if it doesn't exist
if [ ! -f "/etc/systemd/system/hotel-system.service" ]; then
    echo "Creating systemd service..."
    sudo tee /etc/systemd/system/hotel-system.service > /dev/null <<EOL
[Unit]
Description=Hotel Management System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOL

    # Reload systemd
    sudo systemctl daemon-reload
fi

# Start/Restart the service
echo "Restarting service..."
sudo systemctl restart hotel-system
sudo systemctl enable hotel-system

echo "Deployment completed successfully!"
echo "Check status with: sudo systemctl status hotel-system"