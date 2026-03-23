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

        // 검색 쿼리를 더 정밀하게 조정하여 최신순으로 가져옵니다.
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=10`;

        console.log("정식 API로 소식 수집 중...");
        const res = await axios.get(url, {
            headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': CLIENT_SECRET }
        });

        const items = res.data.items || [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 역순으로 처리하여 가장 최신 글이 디스코드 채널 아래쪽에 오도록 함
        for (const item of items.reverse()) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            const postId = match[1];

            if (!lastData.notice.includes(postId)) {
                // 제목과 요약 문구에서 HTML 태그 제거 및 정돈
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');
                const cleanDesc = item.description.replace(/<[^>]*>?/gm, '').substring(0, 150) + "...";

                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 공지사항",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: cleanTitle,
                            url: item.link,
                            description: `\n${cleanDesc}\n\n[공지사항 바로가기](${item.link})`,
                            color: 0x00FFA3, // 치지직 고유 색상
                            footer: {
                                text: "치지직 실시간 소식 알림",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            },
                            timestamp: new Date()
                        }]
                    });
                    console.log(`[발송 완료] ${cleanTitle}`);
                    newIds.push(postId);
                    hasNewUpdate = true;
                    
                    // 디스코드 차단 방지를 위해 2초 대기
                    await sleep(2000); 
                } catch (sendErr) {
                    console.error(`발송 실패: ${sendErr.message}`);
                }
            }
        }

        if (hasNewUpdate) {
            const finalData = { notice: [...new Set(newIds)].slice(-50) };
            fs.writeFileSync(FILE_PATH, JSON.stringify(finalData, null, 2));
            console.log("last_ids.json 기록 완료.");
        } else {
            console.log("새로운 소식이 없습니다.");
        }

    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
