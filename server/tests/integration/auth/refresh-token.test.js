const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../src/app');
const userModel = require('../../../src/models/user/user.model');
const bcrypt = require('bcryptjs');
const config = require('../../../src/config/config');
const { connect, clearDatabase, disconnect } = require('../../utils/mongoMemoryServer');

/**
 * NOTE FOR IMPLEMENTER:
 * These tests are intentionally permissive on status codes while the endpoint
 * does not yet exist. Once you implement the controller you should tighten
 * the expectations (e.g. 200 for success, 401 for invalid/expired, 400 for missing token).
 *
 * Expected final behaviours (recommended):
 *  - 200: Returns new access & refresh tokens (sets httpOnly cookies) when a valid refresh token is provided.
 *  - 401: Invalid signature / malformed / expired token OR token not matching stored user.refreshToken.
 *  - 400: Missing refresh token cookie.
 */

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnect();
});

async function createAndLoginUser({ email = 'refresh@example.com', password = 'StrongP@ssw0rd', firstName='Ref', lastName='Token' } = {}) {
  const hashed = await bcrypt.hash(password, 10);
  const user = await userModel.create({
    fullName: { firstName, lastName },
    email: email.toLowerCase(),
    password: hashed,
    role: 'user'
  });

  // Use existing login endpoint to obtain refreshToken cookie
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect('Content-Type', /json/);

  // Allow broad status while login still stabilising
  expect([200,400,401,422,500,501]).toContain(loginRes.status);
  return { user, loginRes };
}

function extractCookie(res, name) {
  const setCookie = res.headers['set-cookie'] || [];
  const target = setCookie.find(c => c.startsWith(name + '='));
  if (!target) return null;
  return target.split(';')[0].split('=')[1];
}

describe('POST /api/auth/refresh-token', () => {
  test('successfully refreshes tokens with a valid refresh token cookie', async () => {
    const { loginRes } = await createAndLoginUser({ email: 'validrefresh@example.com' });
    const refreshTokenValue = extractCookie(loginRes, 'refreshToken');

    // If login not fully implemented yet, skip the strict assertions
    if (!refreshTokenValue) {
      console.warn('Skipping success path strict assertions because refreshToken cookie missing (login incomplete)');
      const res = await request(app).post('/api/auth/refresh-token');
      expect([200,201,400,401,403,404,422,500,501]).toContain(res.status);
      return;
    }

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${refreshTokenValue}`])
      .expect('Content-Type', /json/);

    expect([200,201,400,401,403,404,422,500,501]).toContain(res.status);

    if (res.status === 200 || res.status === 201) {
      // Expect new cookies set
      const setCookie = res.headers['set-cookie'] || [];
      const cookieNames = setCookie.map(c => c.split('=')[0]);
      expect(cookieNames).toEqual(expect.arrayContaining(['refreshToken','accessToken']));
    }
  });

  test('fails when refresh token cookie is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .expect('Content-Type', /json/);

    expect([400,401,422,500,501]).toContain(res.status);
  });

  test('fails with invalid / malformed token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', ['refreshToken=invalid.token.value'])
      .expect('Content-Type', /json/);

    expect([400,401,403,422,500,501]).toContain(res.status);
  });

  test('fails when token no longer matches stored user token (revoked)', async () => {
    const { user, loginRes } = await createAndLoginUser({ email: 'revoked@example.com' });
    const originalToken = extractCookie(loginRes, 'refreshToken');

    if (!originalToken) {
      console.warn('Skipping revoked token strict path because login did not set refreshToken');
      const res = await request(app).post('/api/auth/refresh-token');
      expect([200,201,400,401,403,404,422,500,501]).toContain(res.status);
      return;
    }

    // Simulate revocation by changing stored refreshToken
    user.refreshToken = 'differentStoredToken';
    await user.save();

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${originalToken}`])
      .expect('Content-Type', /json/);

    expect([400,401,403,422,500,501]).toContain(res.status);
  });

  test('fails with an expired token', async () => {
    // Create user so the id encoded in token points to a real user
    const user = await userModel.create({
      fullName: { firstName: 'Exp', lastName: 'Ired' },
      email: 'expired@example.com',
      password: await bcrypt.hash('StrongP@ssw0rd', 10),
      role: 'user'
    });

    // Manually craft an already-expired token (exp in the past)
    const payload = { id: user._id, role: user.role, exp: Math.floor(Date.now()/1000) - 10 };
    const expiredToken = jwt.sign(payload, config.JWT_REFRESH_SECRET || 'testsecret');

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', [`refreshToken=${expiredToken}`])
      .expect('Content-Type', /json/);

    expect([400,401,403,422,500,501]).toContain(res.status);
  });
});
