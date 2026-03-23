const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkChzzkOfficialFeed() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        // 치지직 공식 계정 프로필 피드 API (가장 정확하고 빠름)
        const feedUrl = "https://apis.naver.com/game_api/game_api/v1/lounge/chzzk/feed/c42cd7ec4855a9edf204a407c3c1dd2?page=1&size=10";
        
        console.log("치지직 공식 계정 새 소식 확인 중...");
        const res = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://game.naver.com/'
            }
        });

        const feeds = (res.data && res.data.data && res.data.data.items) ? res.data.data.items : [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 최신순으로 가져오기 위해 역순 처리
        for (const item of feeds.reverse()) {
            const postId = String(item.feedId);
            const title = item.title || item.contents.substring(0, 50).replace(/\n/g, ' '); // 제목 없으면 본문 요약
            const link = `https://game.naver.com/lounge/chzzk/board/detail/${postId}`;
            const boardName = item.boardName || "공식 소식";

            if (!lastData.notice.includes(postId)) {
                console.log(`[신규 발견] ${title}`);
                
                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 공식 알림",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: `[${boardName}] ${title}`,
                            url: link,
                            color: 0x00FFA3,
                            footer: {
                                text: "치지직 공식 피드 알림",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            },
                            timestamp: new Date()
                        }]
                    });
                    newIds.push(postId);
                    hasNewUpdate = true;
                    await sleep(1500); 
                } catch (sendErr) {
                    console.error(`발송 실패: ${sendErr.message}`);
                    newIds.push(postId);
                }
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-50) }, null, 2));
            console.log("성공: 새로운 소식을 기록했습니다.");
        } else {
            console.log("새로운 소식이 없습니다.");
        }
    } catch (err) {
        console.error('실행 중 오류 발생:', err.message);
    }
}

checkChzzkOfficialFeed();
