module.exports = {
    testEnvironment: 'node',
    testTimeout: 10000,
    setupFilesAfterEnv: ['./tests/setup.js'],
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/tests/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    resetMocks: true,
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '/coverage/'
    ],
    globals: {
        'process.env.JWT_SECRET': 'test-secret-key'
    }
};