const { google } = require('googleapis');

// --- CONFIGURATION ---
const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    YOUTUBE_API_KEY,
    VIDEO_ID_TO_UPDATE,
    TITLE_PREFIX
} = process.env;

const UPDATE_INTERVAL_MS = 30 * 1000; // 30 seconds

// --- YouTube clients ---
// For reading public data (cheap API calls)
const youtubeReadOnly = google.youtube({
    version: 'v3',
    auth: YOUTUBE_API_KEY,
});

// For writing private data (needs OAuth)
const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const youtubeReadWrite = google.youtube({ version: 'v3', auth: oauth2Client });

// --- MAIN FUNCTION ---
async function performUpdate() {
    console.log(`[${new Date().toISOString()}] Starting update cycle...`);
    try {
        // --- Step 1: Get video statistics ---
        const statsResponse = await youtubeReadOnly.videos.list({
            part: 'statistics,snippet',
            id: VIDEO_ID_TO_UPDATE,
        });

        if (!statsResponse.data.items || statsResponse.data.items.length === 0) {
            throw new Error('Could not find video statistics. Check VIDEO_ID and API_KEY.');
        }

        const video = statsResponse.data.items[0];
        const { viewCount, likeCount, commentCount } = video.statistics;
        const { title, publishedAt } = video.snippet;

        const formattedViews = Number(viewCount).toLocaleString();
        const formattedLikes = likeCount ? Number(likeCount).toLocaleString() : 'N/A';
        const formattedComments = commentCount ? Number(commentCount).toLocaleString() : 'N/A';
        const lastEditTime = publishedAt ? new Date(publishedAt).toLocaleString() : 'Unknown';

        console.log(`Views: ${formattedViews}, Likes: ${formattedLikes}, Comments: ${formattedComments}, Last Edited: ${lastEditTime}`);

        // --- Step 2: Update the title if needed ---
        const newTitle = `${TITLE_PREFIX}${formattedViews} Views`;
        if (title !== newTitle) {
            const snippet = { ...video.snippet, title: newTitle };
            console.log(`Updating title to: "${newTitle}"`);
            await youtubeReadWrite.videos.update({
                part: 'snippet',
                requestBody: {
                    id: VIDEO_ID_TO_UPDATE,
                    snippet,
                },
            });
            console.log('✅ Title updated successfully!');
        } else {
            console.log('Title is already up-to-date. Skipping update.');
        }

    } catch (error) {
        console.error('❌ Error during update cycle:');
        if (error.response && error.response.data) {
            console.error(JSON.stringify(error.response.data.error, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

// --- VALIDATE CONFIG ---
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !YOUTUBE_API_KEY || !VIDEO_ID_TO_UPDATE || !TITLE_PREFIX) {
    console.error('FATAL ERROR: Missing required environment variables.');
    process.exit(1);
}

console.log(`YouTube Title Bot starting... will update video ID ${VIDEO_ID_TO_UPDATE} every ${UPDATE_INTERVAL_MS / 1000}s.`);
performUpdate();
setInterval(performUpdate, UPDATE_INTERVAL_MS);
