const axios = require('axios');
const fs = require('fs');

const OFFICIAL_LOUNGE_ID = 'official'; 
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK;

async function checkNotice() {
    try {
        const response = await axios.get(`https://api.chzzk.naver.com/service/v1/channels/${OFFICIAL_LOUNGE_ID}/lounge/posts?size=1`);
        const lastNotice = response.data.content.data[0];
        if (!lastNotice) return;

        const lastSavedId = fs.existsSync('last_id.txt') ? fs.readFileSync('last_id.txt', 'utf8') : '';

        if (lastNotice.postId !== lastSavedId) {
            await axios.post(DISCORD_WEBHOOK_URL, {
                content: `📢 **치지직 새로운 공식 공지**\n\n**제목:** ${lastNotice.title}\n**링크:** https://chzzk.naver.com/lounge/chzzk/posts/${lastNotice.postId}`
            });
            fs.writeFileSync('last_id.txt', lastNotice.postId);
        }
    } catch (e) { console.error(e.message); }
}
checkNotice();
