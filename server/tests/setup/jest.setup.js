// Jest global setup for tests
// We can set environment variables needed for tests here.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';

// Silence console noise in tests (optional)
const originalError = console.error;
console.error = (...args) => {
  if (/DeprecationWarning|ExperimentalWarning/.test(args[0])) return;
  originalError.apply(console, args);
};
