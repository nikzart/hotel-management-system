#!/bin/bash

# Exit on error
set -e

# Configuration
REPO_URL="https://github.com/nikzart/hotel-management-system.git"
APP_DIR="/var/www/hotel-system"
NODE_ENV="production"
LOG_DIR="/var/log/hotel-system"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Print status message
echo "Starting deployment..."

# Install required packages if not present
echo "Checking and installing required packages..."
apt-get update
apt-get install -y nginx nodejs npm

# Create log directory
echo "Setting up log directory..."
mkdir -p $LOG_DIR
chown -R $SUDO_USER:$SUDO_USER $LOG_DIR

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    echo "Creating application directory..."
    mkdir -p $APP_DIR
    chown $SUDO_USER:$SUDO_USER $APP_DIR
    # Clone repository
    echo "Cloning repository..."
    su - $SUDO_USER -c "git clone $REPO_URL $APP_DIR"
else
    # Pull latest changes
    echo "Pulling latest changes..."
    cd $APP_DIR
    su - $SUDO_USER -c "cd $APP_DIR && git pull origin main"
fi

# Install dependencies
echo "Installing dependencies..."
cd $APP_DIR
su - $SUDO_USER -c "cd $APP_DIR && npm install --production"

# Set up environment file
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creating .env file..."
    cp $APP_DIR/.env.example $APP_DIR/.env
    echo "Please update the .env file with your configuration at $APP_DIR/.env"
fi

# Create nginx configuration
echo "Setting up nginx configuration..."
cat > /etc/nginx/sites-available/hotel-system <<EOL
server {
    listen 80;
    server_name _;  # Replace with your domain name

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOL

# Enable nginx site
ln -sf /etc/nginx/sites-available/hotel-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Create systemd service file
echo "Creating systemd service..."
cat > /etc/systemd/system/hotel-system.service <<EOL
[Unit]
Description=Hotel Management System
After=network.target mongod.service

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOL

# Setup MongoDB
echo "Ensuring MongoDB is running..."
systemctl enable mongod
systemctl start mongod

# Reload systemd and restart services
echo "Restarting services..."
systemctl daemon-reload
systemctl restart hotel-system
systemctl enable hotel-system
systemctl restart nginx

echo "Deployment completed successfully!"
echo "Your application is now running behind Nginx on port 80"
echo "Check application status with: systemctl status hotel-system"
echo "Check nginx status with: systemctl status nginx"
echo "Don't forget to:"
echo "1. Update the .env file at $APP_DIR/.env"
echo "2. Configure your domain in /etc/nginx/sites-available/hotel-system"
echo "3. Set up SSL using certbot (recommended):"
echo "   sudo apt-get install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx"