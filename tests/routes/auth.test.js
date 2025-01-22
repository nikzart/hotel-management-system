const request = require('supertest');
const bcrypt = require('bcryptjs');
const createTestApp = require('../test-app');
const db = require('../../src/config/database');

let app;

beforeAll(() => {
    app = createTestApp();
});

beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
});

describe('Auth Routes', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            // Mock db.get to simulate no existing user
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            // Mock db.run for successful user creation
            db.run.mockImplementationOnce((query, params, callback) => {
                callback.bind({ lastID: 1 })(null);
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'staff'
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('message', 'User registered successfully');
        });

        it('should return error for missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'All fields are required');
        });

        it('should prevent duplicate username registration', async () => {
            // Mock db.get to simulate existing user
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { username: 'testuser' });
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'staff'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Username already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        const hashedPassword = bcrypt.hashSync('password123', 10);

        it('should login successfully with correct credentials', async () => {
            // Mock db.get to simulate existing user
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, {
                    user_id: 1,
                    username: 'testuser',
                    password: hashedPassword,
                    role: 'staff'
                });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'password123'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('message', 'Login successful');
        });

        it('should fail with incorrect password', async () => {
            // Mock db.get to simulate existing user
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, {
                    user_id: 1,
                    username: 'testuser',
                    password: hashedPassword,
                    role: 'staff'
                });
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Invalid credentials');
        });

        it('should fail with non-existent username', async () => {
            // Mock db.get to simulate no user found
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null);
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'password123'
                });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Invalid credentials');
        });
    });

    describe('GET /api/auth/me', () => {
        let token;

        beforeEach(async () => {
            // Create a test user and get token
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, null); // No existing user
            });

            db.run.mockImplementationOnce((query, params, callback) => {
                callback.bind({ lastID: 1 })(null);
            });

            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    password: 'password123',
                    role: 'staff'
                });

            token = registerRes.body.token;
        });

        it('should get current user details with valid token', async () => {
            // Mock db.get for user lookup
            db.get.mockImplementationOnce((query, params, callback) => {
                callback(null, {
                    user_id: 1,
                    username: 'testuser',
                    role: 'staff'
                });
            });

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('username', 'testuser');
            expect(res.body).toHaveProperty('role', 'staff');
        });

        it('should fail with no token', async () => {
            const res = await request(app)
                .get('/api/auth/me');

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'No token provided');
        });

        it('should fail with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error', 'Invalid token');
        });
    });
});