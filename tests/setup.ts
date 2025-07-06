// Jest test setup file
import { beforeAll, afterAll } from '@jest/globals';

beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Cleanup after all tests
});

// Mock fetch globally for tests
global.fetch = jest.fn();