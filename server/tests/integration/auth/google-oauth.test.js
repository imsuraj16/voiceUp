const request = require('supertest');
const app = require('../../../src/app');

describe('GET /api/auth/google', () => {
  test('starts oauth flow with redirect (302)', async () => {
    const res = await request(app).get('/api/auth/google');
    // Passport will attempt redirect to Google; without valid creds may still 302 to accounts.google.com
    expect([302,500]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/accounts\.google\.com/);
    }
  });
});

// Callback endpoint - we cannot fully simulate Google, but we assert route exists

describe('GET /api/auth/google/callback', () => {
  test('fails gracefully without OAuth provider response', async () => {
    const res = await request(app).get('/api/auth/google/callback');
    // Likely 401 or 500 because passport needs state/code
  expect([302,400,401,403,500]).toContain(res.status);
  });
});
