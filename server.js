const https = require('https');
const { google } = require('googleapis');

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    VIDEO_ID_TO_UPDATE,
    TITLE_PREFIX
} = process.env;

const UPDATE_INTERVAL_MS = 30 * 1000;

const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const youtubeReadWrite = google.youtube({ version: 'v3', auth: oauth2Client });

let lastStats = { views: null, likes: null, comments: null };

// --- Streaming fetch, robust regex ---
function fetchYouTubeStatsStreaming(videoId) {
    return new Promise((resolve, reject) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        let buffer = '';

        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            res.on('data', chunk => {
                buffer += chunk.toString();

                // Try to match across line breaks
                const match = buffer.match(/ytInitialPlayerResponse\s*=\s*({.*?});\s*<\/script>/s);
                if (match) {
                    res.destroy();
                    try {
                        const data = JSON.parse(match[1]);
                        const videoDetails = data.videoDetails;
                        const microformat = data.microformat?.playerMicroformatRenderer;

                        resolve({
                            title: videoDetails.title,
                            views: videoDetails.viewCount,
                            likes: microformat?.likeCount || 'N/A',
                            comments: videoDetails.commentCount || 'N/A',
                            lastEditTime: microformat?.publishDate || 'Unknown'
                        });
                    } catch (err) {
                        reject(err);
                    }
                }

                // Prevent buffer from growing infinitely
                if (buffer.length > 5_000_000) reject(new Error('ytInitialPlayerResponse not found within first 5MB'));
            });

            res.on('error', reject);
            res.on('end', () => reject(new Error('ytInitialPlayerResponse not found')));
        }).on('error', reject);
    });
}

// --- Main update function ---
async function performUpdate() {
    console.log(`[${new Date().toISOString()}] Fetching stats (streaming)...`);

    try {
        const stats = await fetchYouTubeStatsStreaming(VIDEO_ID_TO_UPDATE);

        const formattedViews = Number(stats.views).toLocaleString();
        const formattedLikes = stats.likes !== 'N/A' ? Number(stats.likes).toLocaleString() : 'N/A';
        const formattedComments = stats.comments !== 'N/A' ? Number(stats.comments).toLocaleString() : 'N/A';

        console.log(`Views: ${formattedViews}, Likes: ${formattedLikes}, Comments: ${formattedComments}, Last Edit: ${stats.lastEditTime}`);

        if (
            lastStats.views === formattedViews &&
            lastStats.likes === formattedLikes &&
            lastStats.comments === formattedComments
        ) {
            console.log('No changes detected. Skipping update.');
            return;
        }

        lastStats = { views: formattedViews, likes: formattedLikes, comments: formattedComments };

        const newTitle = `${TITLE_PREFIX}${formattedViews} Views | ${formattedLikes} Likes | ${formattedComments} Comments`;

        if (stats.title === newTitle) {
            console.log('Title already matches stats. Skipping update.');
            return;
        }

        await youtubeReadWrite.videos.update({
            part: 'snippet',
            requestBody: {
                id: VIDEO_ID_TO_UPDATE,
                snippet: { ...stats, title: newTitle }
            }
        });

        console.log(`✅ Title updated to: "${newTitle}"`);

    } catch (err) {
        console.error('❌ Error during update:', err.message);
    }
}

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !VIDEO_ID_TO_UPDATE || !TITLE_PREFIX) {
    console.error('FATAL ERROR: Missing required environment variables.');
    process.exit(1);
}

console.log(`YouTube Title Bot starting... updating every ${UPDATE_INTERVAL_MS / 1000}s`);
performUpdate();
setInterval(performUpdate, UPDATE_INTERVAL_MS);
