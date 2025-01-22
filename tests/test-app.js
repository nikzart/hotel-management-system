const express = require('express');
const authRoutes = require('../src/routes/auth');
const roomsRoutes = require('../src/routes/rooms');
const guestsRoutes = require('../src/routes/guests');
const bookingsRoutes = require('../src/routes/bookings');
const paymentsRoutes = require('../src/routes/payments');
const servicesRoutes = require('../src/routes/services');
const foodRoutes = require('../src/routes/food');

const createTestApp = () => {
    const app = express();
    
    // Middleware
    app.use(express.json());
    
    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/rooms', roomsRoutes);
    app.use('/api/guests', guestsRoutes);
    app.use('/api/bookings', bookingsRoutes);
    app.use('/api/payments', paymentsRoutes);
    app.use('/api/services', servicesRoutes);
    app.use('/api/food', foodRoutes);
    
    return app;
};

module.exports = createTestApp;