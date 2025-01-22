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

describe('Payment Routes', () => {
    describe('GET /api/payments', () => {
        it('should get all payments when authenticated', async () => {
            const mockPayments = [
                {
                    payment_id: 1,
                    booking_id: 1,
                    amount: 500,
                    payment_method: 'credit_card',
                    payment_status: 'completed',
                    first_name: 'John',
                    last_name: 'Doe',
                    room_number: '101'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockPayments);
            });

            const res = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('payment_method', 'credit_card');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/payments');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('GET /api/payments/booking/:bookingId', () => {
        it('should get payments for a specific booking', async () => {
            const mockPayments = [
                {
                    payment_id: 1,
                    booking_id: 1,
                    amount: 300,
                    booking_total_amount: 500,
                    payment_status: 'completed'
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockPayments);
            });

            const res = await request(app)
                .get('/api/payments/booking/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('payments');
            expect(res.body).toHaveProperty('summary');
            expect(res.body.summary).toHaveProperty('totalPaid', 300);
            expect(res.body.summary).toHaveProperty('remainingAmount', 200);
        });
    });

    describe('POST /api/payments', () => {
        it('should record a new payment successfully', async () => {
            // Mock booking check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { total_amount: 500, payment_status: 'pending' });
            });

            // Mock paid amount check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { paid_amount: 0 });
            });

            // Mock payment creation
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    booking_id: 1,
                    amount: 300,
                    payment_method: 'credit_card',
                    transaction_id: 'txn_123'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Payment recorded successfully');
            expect(res.body).toHaveProperty('paymentId');
            expect(res.body).toHaveProperty('paymentStatus', 'partial');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    booking_id: 1
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Booking ID, amount, and payment method are required');
        });

        it('should fail when payment exceeds total amount', async () => {
            // Mock booking check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { total_amount: 500, payment_status: 'pending' });
            });

            // Mock paid amount check
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { paid_amount: 400 });
            });

            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    booking_id: 1,
                    amount: 200,
                    payment_method: 'credit_card'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Payment amount would exceed booking total amount');
        });
    });

    describe('GET /api/payments/:id', () => {
        it('should get payment details', async () => {
            const mockPayment = {
                payment_id: 1,
                booking_id: 1,
                amount: 500,
                payment_method: 'credit_card',
                payment_status: 'completed',
                first_name: 'John',
                last_name: 'Doe',
                room_number: '101'
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockPayment);
            });

            const res = await request(app)
                .get('/api/payments/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('payment_id', 1);
            expect(res.body).toHaveProperty('payment_method', 'credit_card');
        });

        it('should return 404 for non-existent payment', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .get('/api/payments/999')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Payment not found');
        });
    });

    describe('PUT /api/payments/:id/status', () => {
        it('should update payment status when admin', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            // Mock payment lookup for booking update
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { booking_id: 1 });
            });

            // Mock booking total calculation
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { total_amount: 500, paid_amount: 500 });
            });

            const res = await request(app)
                .put('/api/payments/1/status')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'completed'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Payment status updated successfully');
        });

        it('should fail when staff tries to update status', async () => {
            const res = await request(app)
                .put('/api/payments/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'completed'
                });

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });

        it('should fail with invalid status', async () => {
            const res = await request(app)
                .put('/api/payments/1/status')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'invalid_status'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid payment status');
        });
    });

    describe('GET /api/payments/stats/summary', () => {
        it('should get payment statistics when admin', async () => {
            const mockStats = {
                total_payments: 10,
                total_amount: 5000,
                average_amount: 500,
                completed_payments: 8,
                pending_payments: 1,
                failed_payments: 1,
                total_completed_amount: 4000
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockStats);
            });

            const res = await request(app)
                .get('/api/payments/stats/summary')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('total_payments', 10);
            expect(res.body).toHaveProperty('total_amount', 5000);
            expect(res.body).toHaveProperty('average_amount', 500);
        });

        it('should fail when staff tries to access statistics', async () => {
            const res = await request(app)
                .get('/api/payments/stats/summary')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'User not authorized for this action');
        });
    });
});