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

describe('Service Routes', () => {
    describe('GET /api/services', () => {
        it('should get all active services when authenticated', async () => {
            const mockServices = [
                {
                    service_id: 1,
                    service_name: 'Room Cleaning',
                    rate: 50,
                    status: 'active'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockServices);
            });

            const res = await request(app)
                .get('/api/services')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('service_name', 'Room Cleaning');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/services');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('GET /api/services/:id', () => {
        it('should get a single service', async () => {
            const mockService = {
                service_id: 1,
                service_name: 'Room Cleaning',
                rate: 50,
                status: 'active'
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockService);
            });

            const res = await request(app)
                .get('/api/services/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('service_name', 'Room Cleaning');
        });

        it('should return 404 for non-existent service', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .get('/api/services/999')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Service not found');
        });
    });

    describe('POST /api/services', () => {
        it('should create a new service when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/services')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    service_name: 'Laundry',
                    description: 'Laundry service',
                    rate: 30
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Service created successfully');
            expect(res.body).toHaveProperty('serviceId');
        });

        it('should fail when staff tries to create service', async () => {
            const res = await request(app)
                .post('/api/services')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    service_name: 'Laundry',
                    rate: 30
                });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/services')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    service_name: 'Laundry'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Service name and rate are required');
        });
    });

    describe('PUT /api/services/:id', () => {
        it('should update service when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/services/1')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    rate: 35,
                    description: 'Updated description'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Service updated successfully');
        });

        it('should fail when staff tries to update service', async () => {
            const res = await request(app)
                .put('/api/services/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    rate: 35
                });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail with no update data', async () => {
            const res = await request(app)
                .put('/api/services/1')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'No update data provided');
        });
    });

    describe('POST /api/services/request', () => {
        it('should create a service request for checked-in booking', async () => {
            // Mock booking check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { booking_status: 'checked_in' });
            });

            // Mock request creation
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/services/request')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    booking_id: 1,
                    service_id: 1,
                    notes: 'Urgent request'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Service request created successfully');
            expect(res.body).toHaveProperty('requestId');
        });

        it('should fail for non-checked-in booking', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { booking_status: 'confirmed' });
            });

            const res = await request(app)
                .post('/api/services/request')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    booking_id: 1,
                    service_id: 1
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Service requests can only be made for checked-in bookings');
        });
    });

    describe('GET /api/services/requests/booking/:bookingId', () => {
        it('should get service requests for a booking', async () => {
            const mockRequests = [
                {
                    request_id: 1,
                    service_id: 1,
                    service_name: 'Room Cleaning',
                    status: 'pending',
                    notes: 'Urgent request'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockRequests);
            });

            const res = await request(app)
                .get('/api/services/requests/booking/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('service_name', 'Room Cleaning');
        });
    });

    describe('PUT /api/services/request/:id/status', () => {
        it('should update service request status', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/services/request/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'completed'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Service request status updated successfully');
        });

        it('should fail with invalid status', async () => {
            const res = await request(app)
                .put('/api/services/request/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'invalid_status'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid status');
        });
    });

    describe('GET /api/services/requests/pending', () => {
        it('should get pending service requests when staff', async () => {
            const mockRequests = [
                {
                    request_id: 1,
                    service_name: 'Room Cleaning',
                    room_number: '101',
                    first_name: 'John',
                    last_name: 'Doe',
                    status: 'pending'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockRequests);
            });

            const res = await request(app)
                .get('/api/services/requests/pending')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('service_name', 'Room Cleaning');
        });
    });

    describe('DELETE /api/services/:id', () => {
        it('should delete service when admin and no requests exist', async () => {
            // Mock request check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 0 });
            });

            // Mock deletion
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .delete('/api/services/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Service deleted successfully');
        });

        it('should mark service as inactive when requests exist', async () => {
            // Mock request check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { count: 1 });
            });

            // Mock status update
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .delete('/api/services/1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Service marked as inactive due to existing requests');
        });

        it('should fail when staff tries to delete service', async () => {
            const res = await request(app)
                .delete('/api/services/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });
    });
});