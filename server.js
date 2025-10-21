// ========= START OF FILE: Make sure you copy this line =========

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
        // Store these tokens in the server-side session for this user
        req.session.tokens = tokens;
        console.log("Successfully authenticated and tokens received.");
        res.redirect('/');
    } catch (error) {
        console.error('Error authenticating with Google:', error);
        res.status(500).send('Authentication failed! Please try again.');
    }
});

/**
 * @route POST /update-title
 * @description Handles the form submission to change the video's title.
 */
app.post('/update-title', async (req, res) => {
    // Ensure the user is logged in before proceeding
    if (!req.session.tokens) {
        return res.redirect('/');
    }
    
    // Set the credentials on our OAuth client using the tokens from the session
    oauth2Client.setCredentials(req.session.tokens);
    
    // Create an authenticated YouTube API client
    const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client,
    });

    const newTitle = req.body.newTitle;

    try {
        // The YouTube API requires us to send the entire "snippet" object back.
        // So, first we must fetch the existing snippet.
        const videoResponse = await youtube.videos.list({
            part: 'snippet',
            id: VIDEO_ID,
        });

        if (videoResponse.data.items.length === 0) {
            return res.status(404).send('Error: Video not found with that ID.');
        }

        const videoSnippet = videoResponse.data.items[0].snippet;
        
        // Now, we modify the title on the object we just fetched.
        videoSnippet.title = newTitle;
        console.log(`Attempting to update video title to: "${newTitle}"`);

        // Finally, send the modified snippet object in an 'update' request.
        await youtube.videos.update({
            part: 'snippet',
            requestBody: {
                id: VIDEO_ID,
                snippet: videoSnippet
            },
        });
        
        console.log("Successfully updated video title.");
        res.send(`<h1>Success!</h1><p>Video title updated to: "${newTitle}"</p><a href="/">Go Back</a>`);

    } catch (error) {
        console.error('Error updating video title:', error.response ? error.response.data : error.message);
        res.status(500).send('An error occurred while updating the video title. Check the server logs on Render for details.');
    }
});

/**
 * @route GET /logout
 * @description Clears the session to log the user out.
 */
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // The default session cookie name
        res.redirect('/');
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Ensure all environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.) are set.');
});

// ========= END OF FILE: Make sure you copy this line =========
