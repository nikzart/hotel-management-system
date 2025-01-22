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

describe('Room Routes', () => {
    describe('GET /api/rooms', () => {
        it('should get all rooms when authenticated', async () => {
            const mockRooms = [
                {
                    room_id: 1,
                    room_number: '101',
                    room_type: 'deluxe',
                    rate_per_night: 100,
                    status: 'available'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockRooms);
            });

            const res = await request(app)
                .get('/api/rooms')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('room_number', '101');
        });

        it('should handle database errors gracefully', async () => {
            db.all.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Database error'));
            });

            const res = await request(app)
                .get('/api/rooms')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Error fetching rooms');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/rooms');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('GET /api/rooms/available', () => {
        it('should get available rooms with valid dates', async () => {
            const mockRooms = [
                {
                    room_id: 1,
                    room_number: '101',
                    room_type: 'deluxe',
                    rate_per_night: 100,
                    status: 'available'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockRooms);
            });

            const res = await request(app)
                .get('/api/rooms/available')
                .query({
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05'
                })
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
        });

        it('should handle database errors gracefully', async () => {
            db.all.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Database error'));
            });

            const res = await request(app)
                .get('/api/rooms/available')
                .query({
                    check_in_date: '2024-02-01',
                    check_out_date: '2024-02-05'
                })
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Error fetching available rooms');
        });

        it('should fail without dates', async () => {
            const res = await request(app)
                .get('/api/rooms/available')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Check-in and check-out dates are required');
        });
    });

    describe('POST /api/rooms', () => {
        it('should create a new room when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    room_number: '102',
                    room_type: 'suite',
                    rate_per_night: 200,
                    amenities: ['wifi', 'tv', 'minibar']
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Room created successfully');
            expect(res.body).toHaveProperty('roomId');
        });

        it('should handle database errors gracefully', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Database error'));
            });

            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    room_number: '102',
                    room_type: 'suite',
                    rate_per_night: 200
                });

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Error creating room');
        });

        it('should fail when staff tries to create room', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    room_number: '102',
                    room_type: 'suite',
                    rate_per_night: 200
                });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/rooms')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    room_number: '102'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Room number, type, and rate are required');
        });
    });

    describe('PUT /api/rooms/:id', () => {
        it('should update room when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/rooms/1')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    rate_per_night: 250,
                    status: 'maintenance'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Room updated successfully');
        });

        it('should handle database errors gracefully', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Database error'));
            });

            const res = await request(app)
                .put('/api/rooms/1')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    rate_per_night: 250
                });

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Error updating room');
        });

        it('should fail when staff tries to update room', async () => {
            const res = await request(app)
                .put('/api/rooms/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'maintenance'
                });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail with no update data', async () => {
            const res = await request(app)
                .put('/api/rooms/1')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'No update data provided');
        });
    });

    describe('DELETE /api/rooms/:id', () => {
        it('should delete room when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .delete('/api/rooms/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Room deleted successfully');
        });

        it('should handle database errors gracefully', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Database error'));
            });

            const res = await request(app)
                .delete('/api/rooms/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Error deleting room');
        });

        it('should fail when staff tries to delete room', async () => {
            const res = await request(app)
                .delete('/api/rooms/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail for non-existent room', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .delete('/api/rooms/999')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Room not found');
        });
    });
});