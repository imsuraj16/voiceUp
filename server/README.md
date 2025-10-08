# VoiceUp Backend (Auth + Issues + AI)

A Node.js/Express backend powering the VoiceUp platform. Provides:
- User authentication (local + Google OAuth)
- JWT access & refresh token rotation (secure httpOnly cookies)
- Role-based authorization (user, moderator, department, admin)
- Issue reporting with geolocation, category, images (ImageKit), AI severity scoring & suggestions
- Input validation, sanitization, and structured error responses
- MongoDB persistence with geospatial index for future proximity queries
- AI service (Google Gemini) to score issues and provide suggested actions
- Comprehensive integration tests (Jest + Supertest + in-memory MongoDB)

---
## Table of Contents
1. Features
2. Tech Stack
3. Architecture Overview
4. Getting Started
5. Environment Variables
6. Running the Server
7. API Endpoints
8. Auth Flow Details
9. Testing
10. Error Handling Conventions
11. Security Considerations
12. Deployment Notes
13. Roadmap / Future Enhancements
14. License

---
## 1. Features
- Secure password storage using bcrypt (10 salt rounds)
- JWT-based stateless access control with refresh token rotation
- Role support (user, moderator, department, admin)
- Google OAuth login with automatic role assignment for specific emails
- Validation & sanitization for all user input
- Cookie-based token delivery (httpOnly, secure)
- Modular structure for scalability
- In-memory MongoDB test environment (isolated & deterministic)

## 2. Tech Stack
| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express 5.x |
| Auth | Passport (Google OAuth 2.0), jsonwebtoken |
| DB | MongoDB + Mongoose |
| Validation | express-validator, sanitize-html |
| Security | httpOnly cookies, hashing, token rotation |
| Testing | Jest, Supertest, mongodb-memory-server |

## 3. Architecture Overview
```
server/
  server.js            # Entry point: boots DB + HTTP server
  src/
    app.js             # Express app composition (middleware + routes)
    config/config.js   # Environment variable abstraction
    db/db.js           # Mongo connection logic
    routes/auth.routes.js
    controller/auth.controller.js
    helper/auth.helper.js  # Token generation logic
    models/user/user.model.js
    middlewares/validator.middleware.js
  tests/
    integration/auth/* # Integration tests
    utils/mongoMemoryServer.js # Test DB lifecycle utilities
```

## 4. Getting Started
### Prerequisites
- Node.js >= 18
- MongoDB instance (local or hosted) OR rely solely on tests using in-memory server

### Install Dependencies
```bash
npm install
```

## 5. Environment Variables
Create a `.env` file at project root:
```
MONGO_URI=mongodb://localhost:27017/voiceup_dev
JWT_ACCESS_SECRET=change_me_access_secret
JWT_REFRESH_SECRET=change_me_refresh_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_path
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=development
PORT=3000
```
Descriptions:
- `MONGO_URI`: MongoDB connection string
- `JWT_ACCESS_SECRET`: Secret for signing short-lived access tokens
- `JWT_REFRESH_SECRET`: Secret for signing refresh tokens (rotate on each refresh)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `IMAGEKIT_PUBLIC_KEY` / `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT`: ImageKit credentials for media uploads
- `GEMINI_API_KEY`: Credential for Google Gemini (AI severity scoring & suggestions)
- `NODE_ENV`: `development`, `test`, or `production`
- `PORT`: Port to bind HTTP server

Recommended:
- Use strong, random secrets (>=32 chars)
- Different secrets per environment (dev/stage/prod)
- Never commit real `.env` values; use `.env.example` (add one if missing)

## 6. Running the Server
Development (auto-restart recommended with nodemon if added):
```bash
node server.js
```
Visit: `http://localhost:3000`

## 7. API Endpoints
### Auth
Base path: `/api/auth`

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | /google | Initiate Google OAuth | No |
| GET | /google/callback | OAuth callback | No |
| POST | /register | Register new user | No |
| POST | /login | Login with email/password | No |
| POST | /refresh-token | Rotate tokens using refresh token cookie | Refresh token cookie |

### Request / Response Samples
#### Register
```http
POST /api/auth/register
Content-Type: application/json
{
  "fullName": { "firstName": "Jane", "lastName": "Doe" },
  "email": "jane@example.com",
  "password": "StrongP@ssw0rd"
}
```
Success (201):
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "...",
    "fullName": { "firstName": "Jane", "lastName": "Doe" },
    "email": "jane@example.com",
    "role": "user"
  }
}
```

#### Login
```http
POST /api/auth/login
{
  "email": "jane@example.com",
  "password": "StrongP@ssw0rd"
}
```
Success (200): sets httpOnly `accessToken` & `refreshToken` cookies + user payload.

#### Refresh Token
```http
POST /api/auth/refresh-token
Cookie: refreshToken=xxx
```
Success (200): rotates both cookies and returns message.

### Issues
Base path: `/api/issues`

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | / | Create a new civic issue (with up to 5 images) | accessToken cookie (role: user)

Multipart form fields (Content-Type: multipart/form-data):
```
title=Broken streetlight near main square
description=The streetlight at the northeast corner has been flickering for 3 nights.
category=lighting
address=Main Square, Ward 5
lng=77.5946
lat=12.9716
photos=<file1>
photos=<file2>
```

Alternative `location` JSON form (instead of lat/lng):
```
location={"type":"Point","coordinates":[77.5946,12.9716]}
```

Validation rules:
- title: 5–100 chars
- description: 10–1000 chars
- category: one of road|lighting|waste|safety|water|other
- address: 5–200 chars
- location: GeoJSON Point `[lng, lat]` with bounds

Response (201):
```json
{
  "message": "Issue created successfully",
  "issue": {
    "_id": "...",
    "title": "Broken streetlight near main square",
    "category": "lighting",
    "location": {"type": "Point", "coordinates": [77.5946, 12.9716]},
    "address": "Main Square, Ward 5",
    "status": "reported",
    "images": ["https://ik.imagekit.io/..."],
    "aiScore": 64,
    "aiSuggestions": ["Contact municipal lighting department", "Document flickering pattern if persists"],
    "votesCount": 0,
    "reporterId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

AI fields meaning:
- `aiScore`: Normalized urgency (0–100) derived from Gemini analysis of description
- `aiSuggestions`: Array of recommended next actions (1–N)

Images: Uploaded to ImageKit with randomized UUID filenames; up to 5 accepted via `photos` field (memory storage -> immediate upload).

## 8. Auth Flow Details
1. Registration / Login issues both access & refresh tokens.
2. Access token (1 day expiry) is intended for protected API requests (future middleware).
3. Refresh token (7 day expiry) is stored in DB (user.refreshToken) and rotated on each refresh.
4. Mismatch or expired refresh token => 403/401.
5. Tokens are delivered via httpOnly cookies to mitigate XSS token theft.

### Role Assignment (Google OAuth)
During Google sign-in, certain whitelisted emails are auto-assigned elevated roles:
```
admin@example.com -> admin
mod@example.com   -> moderator
dept@example.com  -> department
others            -> user
```
Existing users keep their role unless they are not in an elevated set and mapping applies.

### Authorization Middleware
`createAuthMiddleware([allowedRoles])` checks:
1. Presence & validity of `accessToken` cookie (verifies with `JWT_ACCESS_SECRET`).
2. Loads user from DB; rejects if missing.
3. Confirms `user.role` is in allowed roles; else 403.
Example (issues route): `createAuthMiddleware(["user"])`.

Token creation (`auth.helper.js`):
```js
jwt.sign({ id, role }, JWT_ACCESS_SECRET, { expiresIn: '1d' })
jwt.sign({ id, role }, JWT_REFRESH_SECRET, { expiresIn: '7d' })
```

## 9. Testing
Run tests:
```bash
npm test
```
Testing stack uses:
- `mongodb-memory-server` to spin up ephemeral DB per suite
- Integration-level coverage for all auth endpoints (register, login, Google OAuth initiation & callback error handling, refresh token scenarios)
- Issue creation integration test (`tests/integration/issue/create-issue.test.js`) covering:
  - Auth requirement (must have valid access token)
  - Validation errors (title length, category enum, coordinates)
  - Image upload mocking (ensure consistent deterministic behavior—add stub if hitting real ImageKit)
  - AI response parsing (consider mocking Gemini for deterministic CI runs)

Add a new test (pattern):
```
describe('Feature X', () => {
  it('should ...', async () => {
    const agent = request(app);
    // arrange -> act -> assert
  });
});
```

## 10. Error Handling Conventions
| Scenario | Status | Example Message |
|----------|--------|-----------------|
| Validation failed | 422 | errors: [...] |
| Duplicate user | 400 | User already exists |
| Invalid credentials | 401 | Invalid credentials |
| Missing refresh token | 401 | No refresh token provided |
| Invalid / mismatched refresh token | 403 | Invalid refresh token |
| Internal server error | 500 | Internal server error |

(Consider normalizing duplicate email to 409 in future.)

## 11. Security Considerations
- httpOnly cookies prevent JS access
- Recommend `secure: process.env.NODE_ENV === 'production'` (currently always true—adjust for local dev over HTTP)
- Add CSRF protection (e.g. double submit token) for state-changing non-idempotent routes in future
- Consider adding rate limiting (e.g., express-rate-limit) to /login & /refresh-token
- Refresh token rotation implemented; consider blacklist or reuse detection to mitigate token replay
- Sanitize inputs to prevent script injection in stored fields

## 12. Deployment Notes
| Aspect | Recommendation |
|--------|---------------|
| Process Manager | Use PM2 or systemd for uptime |
| Logs | Centralize (Winston + JSON -> Log aggregation) |
| Env Management | Use vault/secret manager; avoid committing .env |
| HTTPS | Terminate at reverse proxy (Nginx / Cloud provider) |
| Scaling | Stateless API; ensure MongoDB cluster (Replica Set) |
| Health Checks | Add `/health` endpoint (future) |

Example production run using PM2 (if added later):
```bash
pm2 start server.js --name voiceup-api
```

## 13. Roadmap / Future Enhancements
Short-term:
- Logout endpoint (clear cookies & null stored refreshToken)
- Geospatial issue queries (nearest issues, bounding box) leveraging 2dsphere index
- Issue voting & ranking (increment/decrement + duplicate prevention)
- Issue status workflow (reported -> in_progress -> resolved) with role-based transitions
- Rate limiting (login, refresh-token, issue creation)
- Centralized error formatter & standardized codes (e.g., 409 for duplicate email)
- Mock / abstraction layer for AI service for deterministic tests

Mid-term:
- OpenAPI (Swagger) docs + ReDoc UI
- Request logging (Winston / pino) + correlation / trace IDs
- Password reset + email verification flow
- Image moderation / size limits + optional background processing
- Pagination & filtering for issues (category, status, date range)
- Bulk import tooling (CSV/GeoJSON) for existing civic data

Long-term:
- WebSocket / SSE for real-time issue status updates
- Role management UI & permission matrix
- Multi-tenancy (multiple municipalities) partitioning strategy
- Caching layer (Redis) for hot-read endpoints & rate limiting storage
- Metrics & observability (Prometheus + Grafana integration)
- Dockerfile + docker-compose for local infra (Mongo, Redis, app)
- CI pipeline: lint, test, coverage threshold enforcement

## 14. License
ISC (default). Update this section if you adopt a different license.

---
## Quick Start TL;DR
> Branding Note: Project renamed from CivicVoice → VoiceUp. If upgrading:
> - Rename existing Mongo database (`civicvoice_dev` -> `voiceup_dev`) or update `MONGO_URI`.
> - Existing ImageKit assets remain under `civicvoice/`; new uploads go to `voiceup/` (adjust or migrate as needed).
> - Update any deployment scripts referencing `civicvoice-api` process name.
> - No package.json name change required.
```bash
cp .env.example .env   # (create and fill values)
npm install
node server.js
npm test
```

---
Questions or contributions? Open an issue or submit a PR.
