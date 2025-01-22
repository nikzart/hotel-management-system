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

describe('Food Routes', () => {
    describe('GET /api/food/menu', () => {
        it('should get all available menu items when authenticated', async () => {
            const mockMenuItems = [
                {
                    item_id: 1,
                    name: 'Burger',
                    price: 15,
                    category: 'Main Course',
                    availability: 1
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockMenuItems);
            });

            const res = await request(app)
                .get('/api/food/menu')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('name', 'Burger');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/food/menu');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });

    describe('POST /api/food/menu', () => {
        it('should add menu item when staff', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ lastID: 1 });
            });

            const res = await request(app)
                .post('/api/food/menu')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    name: 'Pizza',
                    description: 'Margherita Pizza',
                    price: 20,
                    category: 'Main Course'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('message', 'Menu item created successfully');
            expect(res.body).toHaveProperty('itemId');
        });

        it('should fail with missing required fields', async () => {
            const res = await request(app)
                .post('/api/food/menu')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    name: 'Pizza',
                    description: 'Margherita Pizza'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Name, price, and category are required');
        });
    });

    describe('PUT /api/food/menu/:id', () => {
        it('should update menu item when staff', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/food/menu/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    price: 25,
                    availability: 0
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Menu item updated successfully');
        });

        it('should fail with no update data', async () => {
            const res = await request(app)
                .put('/api/food/menu/1')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'No update data provided');
        });

        it('should fail for non-existent menu item', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .put('/api/food/menu/999')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    price: 25
                });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Menu item not found');
        });
    });

    describe('GET /api/food/orders', () => {
        it('should get all food orders when authenticated', async () => {
            const mockOrders = [
                {
                    order_id: 1,
                    guest_id: 1,
                    room_id: 1,
                    total_amount: 35,
                    status: 'pending',
                    first_name: 'John',
                    last_name: 'Doe',
                    room_number: '101',
                    items: JSON.stringify([{
                        item_id: 1,
                        name: 'Burger',
                        quantity: 2,
                        price: 15,
                        notes: 'Extra cheese'
                    }])
                }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockOrders);
            });

            const res = await request(app)
                .get('/api/food/orders')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].items).toHaveLength(1);
            expect(res.body[0].items[0]).toHaveProperty('name', 'Burger');
        });
    });

    describe('GET /api/food/orders/:id', () => {
        it('should get a single order with items', async () => {
            const mockOrder = {
                order_id: 1,
                guest_id: 1,
                room_id: 1,
                total_amount: 35,
                status: 'pending',
                first_name: 'John',
                last_name: 'Doe',
                room_number: '101',
                items: JSON.stringify([{
                    item_id: 1,
                    name: 'Burger',
                    quantity: 2,
                    price: 15,
                    notes: 'Extra cheese'
                }])
            };

            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, mockOrder);
            });

            const res = await request(app)
                .get('/api/food/orders/1')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('order_id', 1);
            expect(Array.isArray(res.body.items)).toBe(true);
            expect(res.body.items).toHaveLength(1);
        });

        it('should return 404 for non-existent order', async () => {
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .get('/api/food/orders/999')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Order not found');
        });
    });

    describe('PUT /api/food/orders/:id/status', () => {
        it('should update order status when staff', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 1 });
            });

            const res = await request(app)
                .put('/api/food/orders/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'confirmed'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message', 'Order status updated successfully');
        });

        it('should fail with invalid status', async () => {
            const res = await request(app)
                .put('/api/food/orders/1/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'invalid_status'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid status');
        });

        it('should fail for non-existent order', async () => {
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.call({ changes: 0 });
            });

            const res = await request(app)
                .put('/api/food/orders/999/status')
                .set('Authorization', `Bearer ${staffToken}`)
                .send({
                    status: 'confirmed'
                });

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Order not found');
        });
    });

    describe('GET /api/food/menu/categories', () => {
        it('should get all menu categories when authenticated', async () => {
            const mockCategories = [
                { category: 'Main Course' },
                { category: 'Dessert' },
                { category: 'Beverage' }
            ];

            db.all.mockImplementationOnce((query, params, callback) => {
                callback(null, mockCategories);
            });

            const res = await request(app)
                .get('/api/food/menu/categories')
                .set('Authorization', `Bearer ${staffToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(3);
            expect(res.body).toContain('Main Course');
            expect(res.body).toContain('Dessert');
            expect(res.body).toContain('Beverage');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .get('/api/food/menu/categories');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Access token is required');
        });
    });
});