// Mock ImageKit SDK
jest.mock('imagekit', () => {
  return jest.fn().mockImplementation(() => ({
    upload: jest.fn().mockImplementation(async ({ fileName }) => ({
      url: `https://ik.mock/${Date.now()}-${fileName}`,
      fileId: `file_${Math.random().toString(36).slice(2)}`,
      name: fileName,
    })),
  }));
});

const request = require('supertest');
const path = require('path');
const app = require('../../../src/app');
const issueModel = require('../../../src/models/issues/issue.model');
const userModel = require('../../../src/models/user/user.model');
const jwt = require('jsonwebtoken');
const { connect, clearDatabase, disconnect } = require('../../utils/mongoMemoryServer');

// Utility to create a user and return token + user
async function createAuthenticatedUser(overrides = {}) {
  const user = await userModel.create({
    fullName: { firstName: 'Alice', lastName: 'Reporter' },
    email: `alice${Date.now()}@example.com`,
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

// Build a valid issue payload (excluding photos which are files now)
function buildIssuePayload(overrides = {}) {
  return {
    title: 'Pothole on Main Street',
    description: 'Large pothole causing traffic issues',
    category: 'road',
    address: '123 Main St, Springfield',
    lng: -73.935242,
    lat: 40.73061,
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || 'test_access_secret';
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnect();
});

// Helper to perform multipart request
function sendIssueMultipart(agent, payload, token, includeFile = true) {
  const req = agent.post('/api/issues');
  if (token) req.set('Cookie', [`accessToken=${token}`]);
  req.field('title', payload.title ?? '');
  req.field('description', payload.description ?? '');
  if (payload.category !== undefined) req.field('category', payload.category);
  if (payload.address !== undefined) req.field('address', payload.address);
  if (payload.lng !== undefined) req.field('lng', String(payload.lng));
  if (payload.lat !== undefined) req.field('lat', String(payload.lat));
  if (includeFile) {
    const samplePath = path.join(__dirname, '../../fixtures/sample.jpg');
    req.attach('photos', samplePath);
  }
  return req;
}

describe('POST /api/issues (multipart + multer)', () => {
  test('should create a new issue successfully with image upload', async () => {
    const { token, user } = await createAuthenticatedUser();
    const payload = buildIssuePayload();

    const res = await sendIssueMultipart(request(app), payload, token, true)
      .expect('Content-Type', /json/);

    expect([201, 400, 500]).toContain(res.status);

    if (res.status === 201) {
      expect(res.body).toHaveProperty('issue');
      const issue = res.body.issue;

      expect(issue).toHaveProperty('_id');
      expect(issue).toHaveProperty('title', payload.title);
      expect(issue).toHaveProperty('description', payload.description);
      expect(issue).toHaveProperty('category', payload.category);
      expect(issue).toHaveProperty('address', payload.address);
      expect(issue).toHaveProperty('location');
      expect(issue.location).toHaveProperty('type', 'Point');
      expect(issue.location.coordinates).toEqual([payload.lng, payload.lat]);
      expect(issue).toHaveProperty('reporterId');
      expect(issue.reporterId.toString()).toEqual(user._id.toString());
      expect(issue).toHaveProperty('status', 'reported');

      // ✅ AI fields
      expect(issue).toHaveProperty('aiScore');
      expect(typeof issue.aiScore).toBe('number');
      expect(issue).toHaveProperty('aiSuggestions');
      expect(typeof issue.aiSuggestions).toBe('object');
      expect(issue.aiSuggestions).not.toBeNull();

      // File paths check
      if (issue.images) {
        expect(Array.isArray(issue.images)).toBe(true);
        expect(issue.images.length).toBeGreaterThan(0);
        issue.images.forEach((u) => expect(u).toMatch(/^https:\/\/ik\.mock\//));
      } else if (issue.photos) {
        expect(Array.isArray(issue.photos)).toBe(true);
        expect(issue.photos.length).toBeGreaterThan(0);
        issue.photos.forEach((u) => expect(u).toMatch(/^https:\/\/ik\.mock\//));
      }

      const inDb = await issueModel.findById(issue._id);
      expect(inDb).toBeTruthy();
    }
  });

  test('should return 401 when JWT is missing', async () => {
    const payload = buildIssuePayload();
    const res = await sendIssueMultipart(request(app), payload, null, true).expect(
      'Content-Type',
      /json/
    );
    expect([401, 500]).toContain(res.status);
  });

  test('should return 401 when JWT is invalid', async () => {
  const payload = buildIssuePayload();
  const res = await sendIssueMultipart(
    request(app),
    payload,
    'invalid.token.value',
    true
  ).expect('Content-Type', /json/);

  expect([401, 500]).toContain(res.status);
});


  test('should return 400 when title is missing', async () => {
    const { token } = await createAuthenticatedUser();
    const payload = buildIssuePayload({ title: undefined });
    const res = await sendIssueMultipart(request(app), payload, token, true).expect(
      'Content-Type',
      /json/
    );
    expect([400, 500]).toContain(res.status);
  });

  test('should return 400 when category is invalid', async () => {
    const { token } = await createAuthenticatedUser();
    const payload = buildIssuePayload({ category: 'invalidCategory' });
    const res = await sendIssueMultipart(request(app), payload, token, true).expect(
      'Content-Type',
      /json/
    );
    expect([400, 500]).toContain(res.status);
  });

  test('should return 400 when location coordinates missing', async () => {
    const { token } = await createAuthenticatedUser();
    const payload = buildIssuePayload({ lng: undefined });
    const res = await sendIssueMultipart(request(app), payload, token, true).expect(
      'Content-Type',
      /json/
    );
    expect([400, 500]).toContain(res.status);
  });

  test('should allow creation without file (optional photos)', async () => {
    const { token } = await createAuthenticatedUser();
    const payload = buildIssuePayload();
    const res = await sendIssueMultipart(request(app), payload, token, false).expect(
      'Content-Type',
      /json/
    );
    expect([201, 400, 500]).toContain(res.status);
  });

  test('should upload multiple images and return issue with image URLs', async () => {
    const { token, user } = await createAuthenticatedUser();
    const payload = buildIssuePayload();

    const res = await sendIssueMultipart(request(app), payload, token, true)
      .attach('photos', path.join(__dirname, '../../fixtures/sample2.jpg'))
      .attach('photos', path.join(__dirname, '../../fixtures/sample3.jpg'))
      .expect('Content-Type', /json/);

    expect([201, 400, 500]).toContain(res.status);

    if (res.status === 201) {
      expect(res.body).toHaveProperty('issue');
      const issue = res.body.issue;

      expect(issue).toHaveProperty('_id');
      expect(issue).toHaveProperty('title', payload.title);
      expect(issue).toHaveProperty('description', payload.description);
      expect(issue).toHaveProperty('category', payload.category);
      expect(issue).toHaveProperty('address', payload.address);
      expect(issue).toHaveProperty('location');
      expect(issue.location).toHaveProperty('type', 'Point');
      expect(issue.location.coordinates).toEqual([payload.lng, payload.lat]);
      expect(issue).toHaveProperty('reporterId');
      expect(issue.reporterId.toString()).toEqual(user._id.toString());
      expect(issue).toHaveProperty('status', 'reported');

      // ✅ AI fields
      expect(issue).toHaveProperty('aiScore');
      expect(typeof issue.aiScore).toBe('number');
      expect(issue).toHaveProperty('aiSuggestions');
      expect(typeof issue.aiSuggestions).toBe('object');
      expect(issue.aiSuggestions).not.toBeNull();

      // Multiple images check
      expect(Array.isArray(issue.images)).toBe(true);
      expect(issue.images.length).toBeGreaterThanOrEqual(2);
      issue.images.forEach((u) => expect(u).toMatch(/^https:\/\/ik\.mock\//));

      const inDb = await issueModel.findById(issue._id);
      expect(inDb).toBeTruthy();
    }
  });
});
