module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|functional).ts'],
  testPathIgnorePatterns: ['/dist/'],
};
