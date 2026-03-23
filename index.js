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

        // 공식 라운지 게시글을 가장 잘 잡는 검색 쿼리 (최신순 정렬 강제)
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=20&sort=date`;

        console.log("정식 API로 최신 공지사항 검색 중...");
        const res = await axios.get(url, {
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        const items = res.data.items || [];
        console.log(`검색된 아이템 개수: ${items.length}개`);

        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 검색 결과는 최신순이므로, 오래된 글부터 알림을 보내기 위해 reverse()
        for (const item of items.reverse()) {
            const match = item.link.match(/detail\/(\d+)/);
            if (!match) continue;
            const postId = match[1];

            if (!lastData.notice.includes(postId)) {
                const cleanTitle = item.title.replace(/<[^>]*>?/gm, '').replace(/ : 네이버 게임/g, '');
                
                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 공식 알림",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: cleanTitle,
                            url: item.link,
                            color: 0x00FFA3,
                            footer: {
                                text: "치지직 공식 라운지",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            },
                            timestamp: new Date()
                        }]
                    });
                    console.log(`[발송 성공] ${cleanTitle}`);
                    newIds.push(postId);
                    hasNewUpdate = true;
                    await sleep(1500); 
                } catch (sendErr) {
                    console.error(`발송 실패: ${sendErr.message}`);
                }
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-50) }, null, 2));
            console.log("last_ids.json 기록 완료.");
        } else {
            console.log("새로 발견된 공지가 없습니다.");
        }

    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
