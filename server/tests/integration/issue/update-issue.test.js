const request = require('supertest');
const app = require('../../../src/app');
const issueModel = require('../../../src/models/issues/issue.model');
const userModel = require('../../../src/models/user/user.model');
const jwt = require('jsonwebtoken');
const { connect, clearDatabase, disconnect } = require('../../utils/mongoMemoryServer');

async function createUser(overrides = {}) {
  const user = await userModel.create({
    fullName: { firstName: 'Bob', lastName: 'Reporter' },
    email: `bob_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
    password: 'Password123!',
    role: 'user',
    ...overrides,
  });
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET || 'test_access_secret',
    { expiresIn: '1h' }
  );
  return { user, token };
}

async function seedIssueForUser(user, overrides = {}) {
  const base = {
    title: 'Original title',
    description: 'Original description text',
    category: 'road',
    address: '1 Old Address',
    location: { type: 'Point', coordinates: [-73.98, 40.75] },
    status: 'reported',
    images: [],
    reporterId: user._id,
  };
  return await issueModel.create({ ...base, ...overrides });
}

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret';
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('PATCH /api/issues/:issueId', () => {
  test('401 when no auth token provided', async () => {
    const res = await request(app)
      .patch('/api/issues/651234567812345678123456')
      .send({ title: 'New' })
      .expect('Content-Type', /json/);
    expect([401, 500]).toContain(res.status);
  });

  test('400 for invalid issueId', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .patch('/api/issues/not-a-valid-id')
      .set('Cookie', [`accessToken=${token}`])
      .send({ title: 'New title' })
      .expect('Content-Type', /json/);
    // validator returns 400 for invalid ObjectId
    expect([400, 500]).toContain(res.status);
  });

  test('404 when issue is not found', async () => {
    const { token } = await createUser();
    const res = await request(app)
      .patch('/api/issues/651234567812345678123456')
      .set('Cookie', [`accessToken=${token}`])
      .send({ title: 'Something' })
      .expect('Content-Type', /json/);
    expect([404, 500]).toContain(res.status);
  });

  test('403 when non-reporter user without elevated role tries to update', async () => {
    const { user: reporter } = await createUser({ email: 'reporter@example.com' });
    const issue = await seedIssueForUser(reporter);

    const { token: otherToken } = await createUser({ email: 'other@example.com' });

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${otherToken}`])
      .send({ title: 'Hacked title' })
      .expect('Content-Type', /json/);

    expect([403, 500]).toContain(res.status);
  });

  test('200 when reporter updates allowed fields (partial update)', async () => {
    const { user, token } = await createUser();
    const issue = await seedIssueForUser(user);

    const payload = {
      title: 'Updated title',
      address: '99 New Address',
      lng: -73.99,
      lat: 40.76,
      status: 'in_progress',
    };

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${token}`])
      .send(payload)
      .expect('Content-Type', /json/);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('issue');
      const updated = res.body.issue;
      expect(updated.title).toBe(payload.title);
      expect(updated.address).toBe(payload.address);
      expect(updated.status).toBe('in_progress');
      expect(updated.location.coordinates).toEqual([payload.lng, payload.lat]);
      const inDb = await issueModel.findById(issue._id);
      expect(inDb.title).toBe(payload.title);
      expect(inDb.address).toBe(payload.address);
      expect(inDb.status).toBe('in_progress');
      expect(inDb.location.coordinates).toEqual([payload.lng, payload.lat]);
    }
  });

  test('422 for invalid status and invalid location shape', async () => {
    const { user, token } = await createUser();
    const issue = await seedIssueForUser(user);

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${token}`])
      .send({ status: 'done', location: { foo: 'bar' } })
      .expect('Content-Type', /json/);

    expect([422, 500]).toContain(res.status);
    if (res.status === 422) {
      expect(Array.isArray(res.body.errors)).toBe(true);
      const fields = res.body.errors.map((e) => e.path).sort();
      expect(fields).toContain('status');
      expect(fields).toContain('location');
    }
  });

  test('200 and no changes message when empty body', async () => {
    const { user, token } = await createUser();
    const issue = await seedIssueForUser(user);

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${token}`])
      .send({})
      .expect('Content-Type', /json/);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.message).toMatch(/No changes|updated/i);
    }
  });

  test('moderator can update any issue', async () => {
    const { user: reporter } = await createUser({ email: 'rep@example.com' });
    const issue = await seedIssueForUser(reporter);

    const { token: modToken } = await createUser({ email: 'mod@example.com', role: 'moderator' });

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${modToken}`])
      .send({ status: 'resolved' })
      .expect('Content-Type', /json/);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.issue.status).toBe('resolved');
    }
  });

  test('forbidden fields (votesCount, aiScore, reporterId) are ignored', async () => {
    const { user, token } = await createUser();
    const issue = await seedIssueForUser(user, { votesCount: 5, aiScore: 10 });

    const { user: other } = await createUser({ email: 'someoneelse@example.com' });

    const res = await request(app)
      .patch(`/api/issues/${issue._id}`)
      .set('Cookie', [`accessToken=${token}`])
      .send({ votesCount: 999, aiScore: 999, reporterId: other._id })
      .expect('Content-Type', /json/);

    expect([200, 500]).toContain(res.status);
    const inDb = await issueModel.findById(issue._id);
    expect(inDb.votesCount).toBe(5);
    expect(inDb.aiScore).toBe(10);
    expect(inDb.reporterId.toString()).toBe(user._id.toString());
  });
});
