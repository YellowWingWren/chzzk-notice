const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = (process.env.NAVER_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.NAVER_CLIENT_SECRET || "").trim();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 사용자님이 확인해주신 최신 게시글 번호 기준 (이 미만은 절대 알림 안 보냄)
const TARGET_POST_ID = 7440000; 

async function checkChzzkNotice() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        // 검색 결과 100개까지 확장하여 최신글이 걸릴 확률을 높입니다.
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=100&sort=date`;

        const res = await axios.get(url, {
            headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const item of items.reverse()) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            
            const postIdStr = match[1];
            const postIdNum = parseInt(postIdStr);

            // 1. 이미 보낸 글 제외
            if (lastData.notice.includes(postIdStr)) continue;

            // 2. [철벽 방어] 확인된 최신 번호(7447150)보다 작은 글은 무조건 무시
            if (postIdNum < TARGET_POST_ID) {
                newIds.push(postIdStr);
                continue;
            }

            const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');

            try {
                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 공식 알림",
                    avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                    embeds: [{
                        title: cleanTitle,
                        url: item.link,
                        color: 0x00FFA3,
                        footer: { text: "치지직 실시간 소식" },
                        timestamp: new Date()
                    }]
                });
                
                console.log(`[신규 알림 발송] ${cleanTitle}`);
                newIds.push(postIdStr);
                hasNewUpdate = true;
                await sleep(1500); 
            } catch (sendErr) {
                console.error(`발송 실패: ${sendErr.message}`);
                newIds.push(postIdStr);
            }
        }

        // 업데이트가 있거나, 과거 글을 걸러내서 목록이 변했을 때만 저장
        if (hasNewUpdate || newIds.length !== lastData.notice.length) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-200) }, null, 2));
        }
    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
