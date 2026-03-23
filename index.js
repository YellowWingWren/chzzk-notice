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

        // 검색 정확도를 높이기 위해 쿼리 최적화
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=15&sort=sim`;

        console.log("정식 API로 최신 공지사항 수집 중...");
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
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            
            const postId = match[1];
            const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

            if (!lastData.notice.includes(postId)) {
                console.log(`[신규 알림] ${cleanTitle}`);
                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 알림이",
                    embeds: [{
                        title: `📢 치지직 새로운 소식`,
                        description: cleanTitle,
                        url: item.link,
                        color: 0x00FFA3,
                        timestamp: new Date()
                    }]
                });
                newIds.push(postId);
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            const finalData = { notice: [...new Set(newIds)].slice(-50) };
            fs.writeFileSync(FILE_PATH, JSON.stringify(finalData, null, 2));
            console.log("새로운 ID를 파일에 기록했습니다.");
        } else {
            console.log("새로 올라온 소식이 없습니다.");
        }
    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
