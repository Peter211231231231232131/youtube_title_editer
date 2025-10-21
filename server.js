const { google } = require('googleapis');
PORT = 3000
// --- CONFIGURATION ---
const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    YOUTUBE_API_KEY,
    VIDEO_ID_TO_UPDATE,
    TITLE_PREFIX
} = process.env;

// Update interval: 5 minutes (300,000 ms)
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// --- YouTube clients ---
// Read-only client (API Key) for statistics
const youtubeReadOnly = google.youtube({ version: 'v3', auth: YOUTUBE_API_KEY });

// OAuth client for updating title
const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const youtubeReadWrite = google.youtube({ version: 'v3', auth: oauth2Client });

// --- Track last stats ---
let lastStats = { views: null, likes: null, comments: null };

// --- Main update function ---
async function performUpdate() {
    console.log(`[${new Date().toISOString()}] Fetching stats...`);
    try {
        // Fetch statistics + snippet
        const response = await youtubeReadOnly.videos.list({
            part: 'statistics,snippet',
            id: VIDEO_ID_TO_UPDATE,
        });

        if (!response.data.items || response.data.items.length === 0) {
            throw new Error('Video not found');
        }

        const video = response.data.items[0];
        const { viewCount, likeCount, commentCount } = video.statistics;
        const { title, publishedAt } = video.snippet;

        const formattedViews = Number(viewCount).toLocaleString();
        const formattedLikes = likeCount ? Number(likeCount).toLocaleString() : 'N/A';
        const formattedComments = commentCount ? Number(commentCount).toLocaleString() : 'N/A';
        const lastEditTime = publishedAt ? new Date(publishedAt).toLocaleString() : 'Unknown';

        console.log(`Views: ${formattedViews}, Likes: ${formattedLikes}, Comments: ${formattedComments}, Last Edit: ${lastEditTime}`);

        // Only update if any stat changed
        if (
            lastStats.views === formattedViews &&
            lastStats.likes === formattedLikes &&
            lastStats.comments === formattedComments
        ) {
            console.log('No changes detected. Skipping update.');
            return;
        }

        lastStats = { views: formattedViews, likes: formattedLikes, comments: formattedComments };

        const newTitle = `${TITLE_PREFIX} 🎥 ${formattedViews} Views |👍 ${formattedLikes} Likes | 💬 ${formattedComments} Comments`;

        if (title === newTitle) {
            console.log('Title already up-to-date. Skipping update.');
            return;
        }

        // Update the video title
        await youtubeReadWrite.videos.update({
            part: 'snippet',
            requestBody: {
                id: VIDEO_ID_TO_UPDATE,
                snippet: { ...video.snippet, title: newTitle },
            },
        });

        console.log(`✅ Title updated to: "${newTitle}"`);

    } catch (err) {
        console.error('❌ Error during update:', err.message);
    }
}

// --- Validate config ---
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !YOUTUBE_API_KEY || !VIDEO_ID_TO_UPDATE || !TITLE_PREFIX) {
    console.error('FATAL ERROR: Missing required environment variables.');
    process.exit(1);
}

console.log(`YouTube Title Bot starting... updating every ${UPDATE_INTERVAL_MS / 60000} minutes`);
performUpdate();
setInterval(performUpdate, UPDATE_INTERVAL_MS);
