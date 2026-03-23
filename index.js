const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = (process.env.NAVER_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.NAVER_CLIENT_SECRET || "").trim();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkChzzkNotice() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=10`;

        const res = await axios.get(url, {
            headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const item of items.reverse()) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            const postId = match[1];

            if (!lastData.notice.includes(postId)) {
                // 제목에서 HTML 태그와 불필요한 문구 제거
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');

                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 알림",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: cleanTitle, // 제목 클릭 시 이동
                            url: item.link,
                            color: 0x00FFA3,
                            footer: {
                                text: "치지직 공식 공지사항",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            },
                            timestamp: new Date()
                        }]
                    });
                    
                    newIds.push(postId);
                    hasNewUpdate = true;
                    await sleep(1500); // 전송 간격 유지
                } catch (sendErr) {
                    console.error(`발송 실패: ${sendErr.message}`);
                    newIds.push(postId);
                }
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-50) }, null, 2));
        }
    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
