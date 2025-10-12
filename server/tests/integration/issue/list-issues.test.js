const request = require('supertest');
const app = require('../../../src/app');
const issueModel = require('../../../src/models/issues/issue.model');
const { connect, clearDatabase, disconnect } = require('../../utils/mongoMemoryServer');

// Utility: create an issue with convenience defaults
async function seedIssue(overrides = {}) {
  const base = {
    title: 'Generic issue',
    description: 'Some description of the issue',
    category: 'road',
    address: '123 Main St',
    location: { type: 'Point', coordinates: [-73.9857, 40.7484] }, // NYC
    status: 'reported',
    images: [],
    aiScore: 0,
    aiSuggestions: [],
    votesCount: 0,
  };
  const doc = await issueModel.create({ ...base, ...overrides });
  return doc;
}

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnect();
});

describe('GET /api/issues — listing with query params', () => {
  test('returns 200 and lists issues without auth', async () => {
    await seedIssue({ title: 'Issue A' });
    await seedIssue({ title: 'Issue B' });

    const res = await request(app).get('/api/issues').expect('Content-Type', /json/).expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBe(2);
  });

  test('filters by category', async () => {
    await seedIssue({ title: 'Road issue', category: 'road' });
    await seedIssue({ title: 'Lighting issue', category: 'lighting' });

    const res = await request(app).get('/api/issues').query({ category: 'lighting' }).expect(200);
    const titles = res.body.data.map((i) => i.title);
    expect(titles).toEqual(['Lighting issue']);
    expect(res.body.count).toBe(1);
  });

  test('filters by status', async () => {
    await seedIssue({ title: 'Reported #1', status: 'reported' });
    await seedIssue({ title: 'In progress #1', status: 'in_progress' });
    await seedIssue({ title: 'Resolved #1', status: 'resolved' });

    const res = await request(app).get('/api/issues').query({ status: 'in_progress' }).expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].title).toBe('In progress #1');
  });

  test('filters by bbox (NYC bounds) and excludes outside issues', async () => {
    // Inside NYC-ish
    const inside1 = await seedIssue({ title: 'Inside #1', location: { type: 'Point', coordinates: [-73.99, 40.75] } });
    const inside2 = await seedIssue({ title: 'Inside #2', location: { type: 'Point', coordinates: [-73.95, 40.73] } });
    // Outside (Los Angeles)
    await seedIssue({ title: 'Outside LA', location: { type: 'Point', coordinates: [-118.2437, 34.0522] } });

    const bbox = [-74.10, 40.60, -73.70, 40.90].join(',');
    const res = await request(app).get('/api/issues').query({ bbox }).expect(200);
    const titles = res.body.data.map((i) => i.title).sort();
    expect(titles).toEqual(['Inside #1', 'Inside #2']);
    expect(res.body.count).toBe(2);
    expect(res.body.data.find((i) => i.title === 'Outside LA')).toBeUndefined();
    // sanity: check coordinates order [lng, lat]
    res.body.data.forEach((i) => {
      expect(Array.isArray(i.location.coordinates)).toBe(true);
      expect(i.location.coordinates.length).toBe(2);
    });
  });

  test('returns 400 for invalid bbox (not 4 numbers)', async () => {
    const res = await request(app).get('/api/issues').query({ bbox: '-74,40.6,-73.7' }).expect(400);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 400 for invalid bbox ranges', async () => {
    const res = await request(app)
      .get('/api/issues')
      .query({ bbox: '200,40,210,41' }) // invalid longitudes
      .expect(400);
    expect(res.body).toHaveProperty('message');
  });

  test('sorts by createdAt desc by default', async () => {
    const old = await seedIssue({ title: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') });
    const mid = await seedIssue({ title: 'Middle', createdAt: new Date('2024-06-01T00:00:00Z') });
    const newest = await seedIssue({ title: 'Newest', createdAt: new Date('2025-01-01T00:00:00Z') });

    const res = await request(app).get('/api/issues').expect(200);
    const titles = res.body.data.map((i) => i.title);
    expect(titles).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  test('sorts by createdAt asc when sort=createdAt', async () => {
    await seedIssue({ title: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') });
    await seedIssue({ title: 'Middle', createdAt: new Date('2024-06-01T00:00:00Z') });
    await seedIssue({ title: 'Newest', createdAt: new Date('2025-01-01T00:00:00Z') });

    const res = await request(app).get('/api/issues').query({ sort: 'createdAt' }).expect(200);
    const titles = res.body.data.map((i) => i.title);
    expect(titles).toEqual(['Oldest', 'Middle', 'Newest']);
  });

  test('sorts by aiScore desc', async () => {
    await seedIssue({ title: 'Low', aiScore: 1, createdAt: new Date('2024-01-01T00:00:00Z') });
    await seedIssue({ title: 'Mid', aiScore: 50, createdAt: new Date('2024-01-02T00:00:00Z') });
    await seedIssue({ title: 'High', aiScore: 90, createdAt: new Date('2024-01-03T00:00:00Z') });

    const res = await request(app).get('/api/issues').query({ sort: '-aiScore' }).expect(200);
    const titles = res.body.data.map((i) => i.title);
    expect(titles).toEqual(['High', 'Mid', 'Low']);
  });

  test('sorts by votesCount asc', async () => {
    await seedIssue({ title: 'A', votesCount: 10 });
    await seedIssue({ title: 'B', votesCount: 0 });
    await seedIssue({ title: 'C', votesCount: 5 });

    const res = await request(app).get('/api/issues').query({ sort: 'votesCount' }).expect(200);
    const pairs = res.body.data.map((i) => [i.title, i.votesCount]);
    expect(pairs).toEqual([
      ['B', 0],
      ['C', 5],
      ['A', 10],
    ]);
  });

  test('combined filters: bbox + category + status', async () => {
    // NYC bounds
    const bbox = [-74.10, 40.60, -73.70, 40.90].join(',');
    // inside + matching filters
    await seedIssue({ title: 'Match', category: 'waste', status: 'in_progress', location: { type: 'Point', coordinates: [-73.98, 40.77] } });
    // inside but category mismatch
    await seedIssue({ title: 'Wrong category', category: 'road', status: 'in_progress', location: { type: 'Point', coordinates: [-73.99, 40.78] } });
    // inside but status mismatch
    await seedIssue({ title: 'Wrong status', category: 'waste', status: 'reported', location: { type: 'Point', coordinates: [-73.97, 40.76] } });
    // outside
    await seedIssue({ title: 'Outside', category: 'waste', status: 'in_progress', location: { type: 'Point', coordinates: [-0.1276, 51.5072] } });

    const res = await request(app)
      .get('/api/issues')
      .query({ bbox, category: 'waste', status: 'in_progress' })
      .expect(200);

    expect(res.body.count).toBe(1);
    expect(res.body.data[0].title).toBe('Match');
  });

  test('invalid sort value falls back to default (-createdAt)', async () => {
    await seedIssue({ title: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') });
    await seedIssue({ title: 'Newest', createdAt: new Date('2025-01-01T00:00:00Z') });

    const res = await request(app).get('/api/issues').query({ sort: 'unknown' }).expect(200);
    const titles = res.body.data.map((i) => i.title);
    expect(titles).toEqual(['Newest', 'Oldest']);
  });
});
