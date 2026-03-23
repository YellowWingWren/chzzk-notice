const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = (process.env.NAVER_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.NAVER_CLIENT_SECRET || "").trim();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkChzzkNotice() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=15&sort=sim`;

        console.log("네이버 검색 API 호출 중...");
        const res = await axios.get(url, {
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const item of items) {
            const link = item.link;
            const match = link.match(/detail\/(\d+)/);
            if (!match) continue;
            
            const postId = match[1];
            const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

            // 이미 알림을 보낸 ID가 아니면 전송
            if (!lastData.notice.includes(postId)) {
                console.log(`[새 소식] ${cleanTitle}`);
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 새로운 소식`,
                        description: cleanTitle,
                        url: link,
                        color: 0x00FFA3,
                        timestamp: new Date()
                    }]
                });
                newIds.push(postId);
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            // 최근 50개까지만 보관
            const finalData = { notice: newIds.slice(-50) };
            fs.writeFileSync(FILE_PATH, JSON.stringify(finalData, null, 2));
            console.log("기록 업데이트 완료.");
        } else {
            console.log("새로운 소식이 없습니다.");
        }

    } catch (err) {
        console.error('오류 발생:', err.response ? err.response.data : err.message);
    }
}

checkChzzkNotice();
