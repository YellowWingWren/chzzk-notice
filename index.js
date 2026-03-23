const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = (process.env.NAVER_CLIENT_ID || "").trim();
const CLIENT_SECRET = (process.env.NAVER_CLIENT_SECRET || "").trim();
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

// 대기 함수 (디스코드 차단 방지)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkChzzkNotice() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=15&sort=sim`;

        console.log("정식 API로 소식 수집 중...");
        const res = await axios.get(url, {
            headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const item of items) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            const postId = match[1];

            if (!lastData.notice.includes(postId)) {
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '');
                console.log(`[발송 시도] ${cleanTitle}`);
                
                try {
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
                    // 전송 성공 후 1초 대기 (디스코드 보호)
                    await sleep(1000); 
                } catch (sendErr) {
                    console.error(`발송 실패(${postId}): ${sendErr.message}`);
                    // 발송에 실패해도 일단 목록에 넣어 다음 실행 때 또 보내지 않게 함
                    newIds.push(postId);
                    hasNewUpdate = true;
                }
            }
        }

        // 에러가 났더라도 찾은 결과가 있다면 무조건 파일 저장
        if (hasNewUpdate) {
            const finalData = { notice: [...new Set(newIds)].slice(-50) };
            fs.writeFileSync(FILE_PATH, JSON.stringify(finalData, null, 2));
            console.log("last_ids.json 업데이트 성공.");
        }

    } catch (err) {
        console.error('전체 실행 오류:', err.message);
    }
}

checkChzzkNotice();
