const axios = require('axios');
const fs = require('fs');

// 정식 발급받은 API 키 사용
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

        // 검색 범위를 넓혀 오늘 올라온 글을 더 잘 잡도록 쿼리 수정
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=20&sort=sim`;

        console.log("정식 네이버 API로 공지사항 검색 중...");
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

            // 중복 확인 후 알림 전송
            if (!lastData.notice.includes(postId)) {
                console.log(`[신규 발견] ${cleanTitle}`);
                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 알림이",
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
            // 중복 제거 및 최신 50개 유지
            const finalData = { notice: [...new Set(newIds)].slice(-50) };
            fs.writeFileSync(FILE_PATH, JSON.stringify(finalData, null, 2));
            console.log("last_ids.json 파일에 새로운 ID 기록 완료.");
        } else {
            console.log("새로 올라온 소식이 없습니다.");
        }

    } catch (err) {
        if (err.response && err.response.status === 401) {
            console.error("오류: API 키가 잘못되었거나 권한이 없습니다. (401 Unauthorized)");
        } else {
            console.error('실행 오류:', err.message);
        }
    }
}

checkChzzkNotice();
