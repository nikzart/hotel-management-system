const request = require('supertest');
const jwt = require('jsonwebtoken');
const createTestApp = require('../test-app');
const db = require('../../src/config/database');

let app;
let adminToken;
let staffToken;

beforeAll(() => {
    app = createTestApp();
    
    // Create tokens directly
    adminToken = jwt.sign(
        { id: 1, username: 'admin', role: 'admin' },
        process.env.JWT_SECRET
    );
    
    staffToken = jwt.sign(
        { id: 2, username: 'staff', role: 'staff' },
        process.env.JWT_SECRET
    );
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Booking Routes', () => {
    describe('GET /api/bookings', () => {
        it('should get all bookings when authenticated', async () => {
            const mockBookings = [
                {
                    booking_id: 1,
                    guest_id: 1,
                    room_id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    room_number: '101',
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockBookings);
            });

            const res = await request(app)
                .get('/api/bookings')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('first_name', 'John');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/bookings');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('GET /api/bookings/:id', () => {
        it('should get a single booking with payments', async () => {
            const mockBooking = {
                booking_id: 1,
                guest_id: 1,
                room_id: 1,
                first_name: 'John',
                last_name: 'Doe',
                room_number: '101',
                check_in_date: '2024-02-01',
                check_out_date: '2024-02-05',
                payments: JSON.stringify([{
                    payment_id: 1,
                    amount: 500,
                    payment_method: 'credit_card',
                    payment_status: 'completed'
                }])
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockBooking);
            });

            const res = await request(app)
                .get('/api/bookings/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('first_name', 'John');
            expect(res.body).toHaveProperty('payments');
            expect(Array.isArray(res.body.payments)).toBe(true);
            expect(res.body.payments).toHaveLength(1);
        });

        it('should return 404 for non-existent booking', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .get('/api/bookings/999')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Booking not found');
        });
    });

    describe('POST /api/bookings', () => {
        it('should create a new booking when room is available', async () => {
            // Mock room availability check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 }); // Room is available
            });

            // Mock booking creation
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    guest_id: 1,
                    room_id: 1,
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05',
                    total_amount: 500
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Booking created successfully');
            expect(res.body).toHaveProperty('bookingId');
        });

        it('should fail when room is not available', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 1 }); // Room is not available
            });

            const res = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    guest_id: 1,
                    room_id: 1,
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05',
                    total_amount: 500
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Room is not available for the selected dates');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/bookings')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    guest_id: 1,
                    room_id: 1
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'All fields are required');
        });
    });

    describe('PUT /api/bookings/:id/status', () => {
        it('should update booking status', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/bookings/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'checked_in'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Booking status updated successfully');
        });

        it('should fail with invalid status', async () => {
            const res = await request(app)
                .put('/api/bookings/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'invalid_status'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid booking status');
        });

        it('should fail for non-existent booking', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .put('/api/bookings/999/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'checked_in'
                });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Booking not found');
        });
    });

    describe('PUT /api/bookings/:id', () => {
        it('should update booking details', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/bookings/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    check_out_date: '2024-02-06',
                    total_amount: 600
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Booking updated successfully');
        });

        it('should fail with no update data', async () => {
            const res = await request(app)
                .put('/api/bookings/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'No update data provided');
        });
    });

    describe('GET /api/bookings/range/:start/:end', () => {
        it('should get bookings within date range', async () => {
            const mockBookings = [
                {
                    booking_id: 1,
                    guest_id: 1,
                    room_id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    room_number: '101',
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockBookings);
            });

            const res = await request(app)
                .get('/api/bookings/range/2024-02-01/2024-02-28')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
        });
    });

    describe('DELETE /api/bookings/:id', () => {
        it('should delete booking when admin and no payments exist', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 }); // No payments
            });

            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .delete('/api/bookings/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Booking deleted successfully');
        });

        it('should fail when staff tries to delete booking', async () => {
            const res = await request(app)
                .delete('/api/bookings/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail to delete booking with payments', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 1 }); // Has payments
            });

            const res = await request(app)
                .delete('/api/bookings/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Cannot delete booking with existing payments');
        });

        it('should fail for non-existent booking', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 }); // No payments
            });

            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .delete('/api/bookings/999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Booking not found');
        });
    });
});