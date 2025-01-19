# Hotel Management System

A comprehensive backend system for hotel management built with Node.js, Express, and SQLite.

## Features

- User Authentication & Authorization
- Room Management
- Guest Management
- Booking System
- Payment Processing
- Service Management
- Detailed Reporting

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/me` - Get current user

### Rooms
- GET `/api/rooms` - List all rooms
- GET `/api/rooms/available` - Get available rooms
- GET `/api/rooms/:id` - Get room details
- POST `/api/rooms` - Add new room (admin)
- PUT `/api/rooms/:id` - Update room (admin)
- DELETE `/api/rooms/:id` - Delete room (admin)

### Guests
- GET `/api/guests` - List all guests
- GET `/api/guests/:id` - Get guest details
- POST `/api/guests` - Register new guest
- PUT `/api/guests/:id` - Update guest
- GET `/api/guests/search/query` - Search guests
- DELETE `/api/guests/:id` - Delete guest (admin)

### Bookings
- GET `/api/bookings` - List all bookings
- GET `/api/bookings/:id` - Get booking details
- POST `/api/bookings` - Create new booking
- PUT `/api/bookings/:id` - Update booking
- PUT `/api/bookings/:id/status` - Update booking status
- GET `/api/bookings/range/:start/:end` - Get bookings by date range
- DELETE `/api/bookings/:id` - Delete booking (admin)

### Payments
- GET `/api/payments` - List all payments
- GET `/api/payments/booking/:bookingId` - Get payments for booking
- POST `/api/payments` - Record new payment
- GET `/api/payments/:id` - Get payment details
- PUT `/api/payments/:id/status` - Update payment status (admin)
- GET `/api/payments/stats/summary` - Get payment statistics (admin)

### Services
- GET `/api/services` - List all services
- GET `/api/services/:id` - Get service details
- POST `/api/services` - Create new service (admin)
- PUT `/api/services/:id` - Update service (admin)
- POST `/api/services/request` - Create service request
- GET `/api/services/requests/booking/:bookingId` - Get service requests for booking
- PUT `/api/services/request/:id/status` - Update service request status
- GET `/api/services/requests/pending` - Get pending service requests (staff)
- DELETE `/api/services/:id` - Delete service (admin)

## Setup

1. Clone the repository
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

## Database

The system uses SQLite as the database, which will be automatically created at first run. The database file will be created as `hotel.db` in the root directory.

## User Roles

- **Admin**: Full access to all features
- **Staff**: Access to service management and basic operations
- **User**: Basic access for viewing rooms and making bookings

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
```
Authorization: Bearer your-token-here
```

## Error Handling

The API returns appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Development

To install development dependencies:
```bash
npm install --save-dev nodemon
```

## Security Considerations

1. Change the JWT_SECRET in production
2. Use HTTPS in production
3. Implement rate limiting for production use
4. Regular database backups
5. Input validation and sanitization
6. Proper error logging

## License

ISC