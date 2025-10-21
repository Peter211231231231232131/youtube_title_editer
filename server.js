const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse form data and handle sessions
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET, // Loaded from Render environment variables
    resave: false,
    saveUninitialized: true,
    cookie: { secure: 'auto' } // Use secure cookies in production
}));

// --- Google OAuth2 Client Setup ---
// These details are loaded securely from your Render environment variables
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
);

// This is the "permission" we are asking the user for.
// It allows the app to manage YouTube videos on their behalf.
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

// The ID of the video we want to edit, loaded from environment variables
const VIDEO_ID = process.env.VIDEO_ID_TO_UPDATE;


// ========== ROUTES ==========

/**
 * @route GET /
 * @description The homepage.
 * - If the user is not logged in, it shows a "Login with Google" link.
 * - If the user is logged in, it shows the form to update the video title.
 */
app.get('/', (req, res) => {
    // Check if we have authentication tokens stored in the user's session
    if (!req.session.tokens) {
        // If not, generate the unique authentication URL for the user to click
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Required to get a refresh token
            scope: SCOPES,
        });
        // Display the login page
        return res.send(`
            <h1>YouTube Title Editor</h1>
            <h2>Step 1: Log In</h2>
            <p>You need to authorize this application to manage your YouTube videos.</p>
            <a href="${authUrl}" style="font-size: 1.2em; padding: 10px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 5px;">
                Login with Google
            </a>
        `);
    }

    // If we are logged in, display the title update form
    res.send(`
        <h1>YouTube Title Editor</h1>
        <h2>Step 2: Update Your Video Title</h2>
        <p>You are successfully logged in!</p>
        <p><strong>Editing Video ID:</strong> ${VIDEO_ID}</p>
        <form action="/update-title" method="POST" style="margin-top: 20px;">
            <label for="newTitle">New Video Title:</label><br>
            <input type="text" id="newTitle" name="newTitle" required size="60" style="padding: 8px;">
            <button type="submit" style="padding: 8px;">Update Title</button>
        </form>
        <br>
        <a href="/logout">Logout</a>
    `);
});

/**
 * @route GET /oauth2callback
 * @description The page Google redirects to after the user logs in.
 * - It receives a special 'code' from Google.
 * - It exchanges that code for authentication tokens.
 * - It saves the tokens in the user's session and redirects to the homepage.
 */
app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query; // The authorization code from Google
    try {
        // Exchange the code for access and refresh tokens
        const { tokens } = await oauth2Client.getToken(code);
        // Store these tokens in the server-side sess
