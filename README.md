# Hotel Management System

A comprehensive backend system for hotel management built with Node.js, Express, SQLite, and Socket.IO for real-time features.

## Features

- User Authentication & Authorization
- Room Management
- Guest Management
- Booking System
- Payment Processing
- Service Management
- Real-time Chat System
- Food Ordering System
- Real-time Service Requests

## Documentation

- [Detailed API Documentation](docs/API.md) - Complete API reference with examples
- [Socket.IO Events](docs/API.md#real-time-features) - Real-time communication documentation

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/nikzart/hotel-management-system.git
cd hotel-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file with required environment variables:
```
PORT=3000
JWT_SECRET=your-secret-key
NODE_ENV=development
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Core Components

### 1. Authentication System
- JWT-based authentication
- Role-based access control (Admin, Staff, Guest)
- Secure password hashing

### 2. Room Management
- Room availability tracking
- Room type and rate management
- Amenities tracking
- Maintenance status

### 3. Guest Management
- Guest registration and profiles
- Booking history
- ID verification
- Contact information

### 4. Booking System
- Real-time availability checking
- Reservation management
- Check-in/check-out processing
- Rate calculation

### 5. Payment System
- Multiple payment methods
- Payment tracking
- Invoice generation
- Refund processing

### 6. Service Management
- Service request handling
- Task assignment
- Status tracking
- Service completion verification

### 7. Real-time Features
- Chat between guests and staff
- Instant service requests
- Live order status updates
- Real-time notifications

### 8. Food Ordering System
- Digital menu management
- Real-time order processing
- Kitchen notifications
- Order tracking
- Special requests handling

## API Endpoints

See [API Documentation](docs/API.md) for detailed endpoint information and examples.

## Database Schema

The system uses SQLite with the following main tables:
- users
- rooms
- guests
- bookings
- payments
- services
- chat_messages
- food_menu
- food_orders

## Real-time Communication

Uses Socket.IO for:
- Chat functionality
- Service requests
- Order updates
- Status notifications

## Security Features

1. Authentication & Authorization
   - JWT token verification
   - Role-based access control
   - Password hashing with bcrypt

2. Data Protection
   - Input validation
   - SQL injection prevention
   - XSS protection

3. API Security
   - Rate limiting
   - CORS configuration
   - Error handling

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation
```bash
npm install
npm install --save-dev nodemon
```

### Running Tests
```bash
npm test
```

### Development Server
```bash
npm run dev
```

## Production Deployment

1. Update environment variables
2. Set NODE_ENV to 'production'
3. Use process manager (e.g., PM2)
4. Enable HTTPS
5. Set up database backups
6. Configure logging

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Support

For support, email [nikzart.code@gmail.com](mailto:nikzart.code@gmail.com)