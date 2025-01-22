const createTestDb = () => {
    return Promise.resolve({
        run: jest.fn((query, params, callback) => {
            if (callback) callback(null);
            return { lastID: 1, changes: 1 };
        }),
        get: jest.fn((query, params, callback) => {
            if (callback) callback(null, null);
        }),
        all: jest.fn((query, params, callback) => {
            if (callback) callback(null, []);
        }),
        exec: jest.fn((query, callback) => {
            if (callback) callback(null);
        }),
        close: jest.fn()
    });
};

module.exports = createTestDb;