const jwt = require('jsonwebtoken');

// Set environment variables before any imports
process.env.JWT_SECRET = 'test-secret-key';

// Mock the database module
jest.mock('../src/config/database', () => ({
    run: jest.fn((query, params, callback) => {
        if (callback) {
            callback.call({ lastID: 1, changes: 1 });
        }
        return { lastID: 1, changes: 1 };
    }),
    get: jest.fn((query, params, callback) => {
        if (query.includes('SELECT * FROM users WHERE user_id = ?')) {
            const userId = params[0];
            callback(null, {
                user_id: userId,
                username: userId === 1 ? 'admin' : 'staff',
                role: userId === 1 ? 'admin' : 'staff'
            });
        } else if (query.includes('SELECT * FROM users WHERE username = ?')) {
            callback(null, null); // Allow new user registration
        } else {
            callback(null, null);
        }
    }),
    all: jest.fn((query, params, callback) => {
        callback(null, []);
    }),
    exec: jest.fn((query, callback) => {
        if (callback) callback(null);
    }),
    close: jest.fn()
}));

// Set up test environment
beforeAll(() => {
    // Additional setup if needed
});

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
    jest.resetModules();
});