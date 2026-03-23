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

        // 최신순 정렬(sim 대신 date)을 시도하지만, 데이터가 섞여 올 수 있음
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=30&sort=date`;

        console.log("정식 API로 데이터 수집 및 최신글 필터링 중...");
        const res = await axios.get(url, {
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 현재 날짜 기준 (대한민국 시간)
        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

        for (const item of items.reverse()) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            const postId = match[1];

            // 1. 이미 보낸 글인지 확인
            if (lastData.notice.includes(postId)) continue;

            // 2. 제목에서 HTML 제거
            const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');

            // 💡 [핵심] 2년 전 글 방어 로직
            // 검색 API가 주는 요약문에 '2022', '2023', '2년 전' 등의 문구가 있으면 과감히 버립니다.
            const desc = item.description;
            const isTooOld = /2022|2023|2024|1년 전|2년 전/.test(desc) || /2022|2023|2024/.test(cleanTitle);
            
            if (isTooOld) {
                // 알림은 안 보내지만, 다시 검색되지 않게 ID 기록에는 추가
                newIds.push(postId);
                continue;
            }

            try {
                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 공식 알림",
                    avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                    embeds: [{
                        title: cleanTitle,
                        url: item.link,
                        color: 0x00FFA3,
                        footer: { text: "치지직 공식 라운지" },
                        timestamp: new Date()
                    }]
                });
                
                console.log(`[신규 알림] ${cleanTitle}`);
                newIds.push(postId);
                hasNewUpdate = true;
                await sleep(1500); 
            } catch (sendErr) {
                console.error(`발송 에러: ${sendErr.message}`);
                newIds.push(postId);
            }
        }

        if (hasNewUpdate || newIds.length !== lastData.notice.length) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-100) }, null, 2));
            console.log("최신 기록 업데이트 완료.");
        }

    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
