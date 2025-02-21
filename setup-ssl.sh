#!/bin/bash

# Exit on error
set -e

# Check if URL was provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <domain>"
    echo "Example: $0 example.com"
    exit 1
fi

DOMAIN=$1
APP_DIR="/var/www/hotel-system"

# Check for root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (sudo)"
    exit 1
fi

# Check if application is deployed
if [ ! -d "$APP_DIR" ]; then
    echo "Error: Application directory not found. Please run deploy.sh first."
    exit 1
fi

# Print status message
echo "Starting SSL setup for $DOMAIN..."

# Install certbot and nginx plugin
echo "Installing certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Update nginx configuration with domain
echo "Updating nginx configuration..."
sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/hotel-system

# Test nginx configuration
nginx -t

# Reload nginx to apply domain change
systemctl reload nginx

# Obtain SSL certificate
echo "Obtaining SSL certificate for $DOMAIN..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email webmaster@$DOMAIN --redirect

# Final nginx reload
systemctl reload nginx

echo "SSL setup completed successfully!"
echo "Your application is now accessible at https://$DOMAIN"
echo "SSL certificate will auto-renew when needed"
