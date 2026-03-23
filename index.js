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

        // 치지직 공식 계정의 실제 피드 데이터 통로
        const feedUrl = "https://apis.naver.com/game_api/game_api/v1/lounge/chzzk/feed/c42cd7ec4855a9edf204a407c3c1dd2?page=1&size=10";
        
        const res = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://game.naver.com/'
            }
        });

        const feeds = (res.data && res.data.data && res.data.data.items) ? res.data.data.items : [];
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 과거 글부터 순차적으로 알림 (역순 처리)
        for (const item of feeds.reverse()) {
            const postId = String(item.feedId);
            const title = item.title || (item.contents ? item.contents.substring(0, 50) : "새로운 소식");
            const link = `https://game.naver.com/lounge/chzzk/board/detail/${postId}`;
            const boardName = item.boardName || "공식";

            if (!lastData.notice.includes(postId)) {
                try {
                    await axios.post(DISCORD_WEBHOOK, {
                        username: "치지직 공식 알림",
                        avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                        embeds: [{
                            title: `[${boardName}] ${title}`,
                            url: link,
                            color: 0x00FFA3,
                            footer: {
                                text: "치지직 공식 피드 실시간 알림",
                                icon_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png"
                            },
                            timestamp: new Date()
                        }]
                    });
                    newIds.push(postId);
                    hasNewUpdate = true;
                    await sleep(1500); // 디스코드 차단 방지
                } catch (sendErr) {
                    console.error(`발송 실패: ${sendErr.message}`);
                }
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-50) }, null, 2));
            console.log("새로운 소식들을 기록했습니다.");
        } else {
            console.log("새로운 소식이 없습니다.");
        }
    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkOfficialFeed();
