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

        // 검색 데이터 개수를 늘려 더 많은 정보를 확보합니다.
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
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');
                
                // 본문 내용을 최대한 살리기 위한 필터링
                let cleanDesc = item.description
                    .replace(/<[^>]*>?/gm, '')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/\s+/g, ' ') // 불필요한 공백 제거
                    .trim();

                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 실시간 알림",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: `📄 ${cleanTitle}`,
                            url: item.link,
                            // 설명란(description)에 내용을 집중 배치
                            description: `\n> ${cleanDesc}\n\n**[공지사항 전체 읽기](${item.link})**`,
                            color: 0x00FFA3,
                            timestamp: new Date(),
                            footer: {
                                text: "치지직 공식 라운지 알림",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            }
                        }]
                    });
                    
                    newIds.push(postId);
                    hasNewUpdate = true;
                    await sleep(2000); // 429 에러 방지
                } catch (sendErr) {
                    console.error(`발송 에러: ${sendErr.message}`);
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
