// 다시 시도해볼 코드 (동일하지만 로그를 조금 더 자세히 찍도록 수정했습니다)
const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkChzzkNotice() {
    try {
        let lastIds = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastIds = content ? JSON.parse(content) : { notice: [] };
        }

        console.log("네이버 검색 API 호출 시도 중...");
        
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=10&sort=sim`;

        const res = await axios.get(url, {
            headers: {
                'X-Naver-Client-Id': CLIENT_ID.trim(), // 공지: 혹시 모를 공백 제거
                'X-Naver-Client-Secret': CLIENT_SECRET.trim()
            }
        });

        const items = res.data.items || [];
        let hasNew = false;

        for (const item of items) {
            const link = item.link;
            const match = link.match(/detail\/(\d+)/);
            if (!match) continue;
            
            const postId = match[1];
            const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');

            if (!lastIds.notice.includes(postId)) {
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 소식 (검색 기반)`,
                        description: cleanTitle,
                        url: link,
                        color: 0x00FFA3,
                        timestamp: new Date()
                    }]
                });
                lastIds.notice.push(postId);
                hasNew = true;
            }
        }

        if (hasNew) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("알림 발송 성공.");
        } else {
            console.log("새 소식이 검색되지 않았습니다.");
        }

    } catch (err) {
        if (err.response) {
            console.error(`에러 발생 (상태 코드: ${err.response.status})`);
            console.error("네이버 서버 응답:", err.response.data);
        } else {
            console.error('오류:', err.message);
        }
    }
}

checkChzzkNotice();
