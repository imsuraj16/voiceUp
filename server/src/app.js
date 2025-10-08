const cookieParser = require('cookie-parser');
const passport = require('passport');
const express = require('express');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const authRoutes = require('./routes/auth.routes');
const issueRoutes = require('./routes/issue.routes');


// Create an Express application
const app = express();
app.use(passport.initialize());
app.use(express.json());
app.use(cookieParser());



// Configure Passport to use Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  // Here, you would typically find or create a user in your database
  // For this example, we'll just return the profile
  return done(null, profile);
}));



// Define routes
//auth routes
app.use('/api/auth',authRoutes);

//issue Routes
app.use('/api/issues', issueRoutes);

// Global JSON error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

module.exports = app;