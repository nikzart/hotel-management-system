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

describe('Guest Routes', () => {
    describe('GET /api/guests', () => {
        it('should get all guests when authenticated', async () => {
            const mockGuests = [
                {
                    guest_id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com',
                    phone: '1234567890'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockGuests);
            });

            const res = await request(app)
                .get('/api/guests')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('first_name', 'John');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/guests');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('GET /api/guests/:id', () => {
        it('should get a single guest with bookings', async () => {
            const mockGuest = {
                guest_id: 1,
                first_name: 'John',
                last_name: 'Doe',
                email: 'john@example.com',
                bookings: JSON.stringify([{
                    booking_id: 1,
                    room_id: 1,
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05',
                    booking_status: 'confirmed',
                    payment_status: 'pending'
                }])
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockGuest);
            });

            const res = await request(app)
                .get('/api/guests/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('first_name', 'John');
            expect(res.body).toHaveProperty('bookings');
            expect(Array.isArray(res.body.bookings)).toBe(true);
            expect(res.body.bookings).toHaveLength(1);
        });

        it('should return 404 for non-existent guest', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .get('/api/guests/999')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Guest not found');
        });
    });

    describe('POST /api/guests', () => {
        it('should create a new guest when authenticated', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/guests')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane@example.com',
                    phone: '0987654321'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Guest registered successfully');
            expect(res.body).toHaveProperty('guestId');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/guests')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    email: 'jane@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'First name and last name are required');
        });

        it('should fail with duplicate email', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback({ message: 'UNIQUE constraint failed: guests.email' });
            });

            const res = await request(app)
                .post('/api/guests')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'john@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Email already registered');
        });
    });

    describe('PUT /api/guests/:id', () => {
        it('should update guest when authenticated', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/guests/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    phone: '5555555555',
                    address: 'New Address'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Guest profile updated successfully');
        });

        it('should fail with no update data', async () => {
            const res = await request(app)
                .put('/api/guests/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'No update data provided');
        });

        it('should fail with duplicate email', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback({ message: 'UNIQUE constraint failed: guests.email' });
            });

            const res = await request(app)
                .put('/api/guests/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    email: 'existing@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Email already exists');
        });
    });

    describe('GET /api/guests/search/query', () => {
        it('should search guests by term', async () => {
            const mockGuests = [
                {
                    guest_id: 1,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockGuests);
            });

            const res = await request(app)
                .get('/api/guests/search/query')
                .query({ term: 'John' })
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('first_name', 'John');
        });

        it('should fail without search term', async () => {
            const res = await request(app)
                .get('/api/guests/search/query')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Search term is required');
        });
    });

    describe('DELETE /api/guests/:id', () => {
        it('should delete guest when admin and no bookings exist', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 });
            });

            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .delete('/api/guests/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Guest deleted successfully');
        });

        it('should fail when staff tries to delete guest', async () => {
            const res = await request(app)
                .delete('/api/guests/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail to delete guest with bookings', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 1 });
            });

            const res = await request(app)
                .delete('/api/guests/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Cannot delete guest with existing bookings');
        });

        it('should fail for non-existent guest', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 });
            });

            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .delete('/api/guests/999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Guest not found');
        });
    });
});