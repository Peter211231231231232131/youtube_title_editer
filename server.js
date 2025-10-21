const { google } = require('googleapis');

// --- CONFIGURATION ---
// Load all required secrets from Render's environment variables
const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    YOUTUBE_API_KEY,
    VIDEO_ID_TO_UPDATE,
    TITLE_PREFIX
} = process.env;

const UPDATE_INTERVAL_MS = 30 * 1000; // 30 seconds

// --- A NOTE ON API USAGE ---
// We use two separate clients for a reason:
// 1. A simple API Key is used for READING public data (getting view count). This is a very cheap API call.
// 2. The full OAuth client is used for WRITING data (updating the title). This is more expensive and requires user permission (via the refresh token).

// Create the YouTube service client for READING public data
const youtubeReadOnly = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY,
});

// Create and configure the OAuth client for WRITING data
const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
);
// Set the refresh token. This is the key to unattended authentication.
oauth2Client.setCredentials({
    refresh_token: GOOGLE_REFRESH_TOKEN,
});
// Create the YouTube service client for WRITING private data
const youtubeReadWrite = google.youtube({
    version: 'v3',
    auth: oauth2Client,
});


/**
 * The main function that performs a single update cycle.
 */
async function performUpdate() {
    console.log(`[${new Date().toISOString()}] Starting update cycle...`);
    try {
        // --- STEP 1: Get the current view count ---
        const statsResponse = await youtubeReadOnly.videos.list({
            part: 'statistics',
            id: VIDEO_ID_TO_UPDATE,
        });

        if (!statsResponse.data.items || statsResponse.data.items.length === 0) {
            throw new Error('Could not find video statistics. Check your VIDEO_ID and API_KEY.');
        }

        const viewCount = statsResponse.data.items[0].statistics.viewCount;
        const formattedViews = Number(viewCount).toLocaleString();
        console.log(`Current view count: ${formattedViews}`);

        // --- STEP 2: Get the current video snippet (needed for the update) ---
        const snippetResponse = await youtubeReadOnly.videos.list({
            part: 'snippet',
            id: VIDEO_ID_TO_UPDATE,
        });

        if (!snippetResponse.data.items || snippetResponse.data.items.length === 0) {
            throw new Error('Could not find video snippet.');
        }
        
        const snippet = snippetResponse.data.items[0].snippet;
        const newTitle = `${TITLE_PREFIX}${formattedViews} Views`;

        // --- STEP 3: Update the title if it has changed ---
        if (snippet.title === newTitle) {
            console.log('Title is already up-to-date. Skipping update.');
            return;
        }

        snippet.title = newTitle; // Set the new title on the snippet object

        console.log(`Attempting to update title to: "${newTitle}"`);
        await youtubeReadWrite.videos.update({
            part: 'snippet',
            requestBody: {
                id: VIDEO_ID_TO_UPDATE,
                snippet: snippet,
            },
        });

        console.log('✅ Successfully updated video title!');

    } catch (error) {
        console.error('❌ An error occurred during the update cycle:');
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data.error, null, 2));
        } else {
            console.error(error.message);
        }
    }
}


// --- MAIN EXECUTION ---
// Verify that all required environment variables are set before starting.
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !YOUTUBE_API_KEY || !VIDEO_ID_TO_UPDATE || !TITLE_PREFIX) {
    console.error('FATAL ERROR: One or more required environment variables are missing.');
    console.log('Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, YOUTUBE_API_KEY, VIDEO_ID_TO_UPDATE, and TITLE_PREFIX.');
    process.exit(1); // Exit the script if configuration is incomplete.
}

console.log("YouTube Title Bot starting up...");
console.log(`Will update title for video ID ${VIDEO_ID_TO_UPDATE} every ${UPDATE_INTERVAL_MS / 1000} seconds.`);

// Run the update function immediately on startup.
performUpdate();

// Then, set it to run on a recurring interval.
setInterval(performUpdate, UPDATE_INTERVAL_MS);
