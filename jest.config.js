module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|functional|integration).ts'],
  testPathIgnorePatterns: ['/dist/'],
  setupFiles: ['./jest.setup.js'],
};
