const { google } = require('googleapis');
const readline = require('readline');
PORT = 3000
// --- PASTE YOUR CREDENTIALS HERE ---
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = 'YOUR_GOOGLE_CLIENT_SECRET';
// This MUST match the one in your Google Cloud Console
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
// --- END OF CREDENTIALS ---

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

// This function creates the URL
function generateAuthUrl() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // IMPORTANT: This is what requests the refresh token
        scope: SCOPES,
        prompt: 'consent' // Forces the consent screen, ensuring a refresh token is issued
    });
    console.log('Authorize this app by visiting this url:');
    console.log(authUrl);
}

// This function exchanges the code for tokens
async function getTokens(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('\nAuthentication successful!');
        console.log('Your access token is (expires in 1 hour):', tokens.access_token);
        console.log('---');
        console.log('✅ YOUR REFRESH TOKEN (SAVE THIS! IT DOES NOT EXPIRE):');
        console.log(tokens.refresh_token);
        console.log('---');
        console.log('Copy the refresh_token value and add it to your Render environment variables.');
    } catch (error) {
        console.error('Error while trying to retrieve access token', error);
    }
}

// --- Main script logic ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

generateAuthUrl();

rl.question('\nEnter the code from that page here: ', (code) => {
    rl.close();
    getTokens(code.trim());
});
