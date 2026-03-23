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

        // 공식 피드 API 주소 확인
        const feedUrl = "https://apis.naver.com/game_api/game_api/v1/lounge/chzzk/feed/c42cd7ec4855a9edf204a407c3c1dd2?page=1&size=10";
        
        console.log("데이터 수집을 시작합니다...");
        const res = await axios.get(feedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://game.naver.com/lounge/chzzk/home',
                'Origin': 'https://game.naver.com',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        // 데이터 경로가 올바른지 확인하는 로그 추가
        const items = res.data?.data?.items || [];
        console.log(`수집된 아이템 개수: ${items.length}개`);

        if (items.length === 0) {
            console.log("서버에서 빈 목록을 반환했습니다. 헤더 설정을 확인해야 할 수도 있습니다.");
            return;
        }

        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const item of items.reverse()) {
            const postId = String(item.feedId);
            
            if (!lastData.notice.includes(postId)) {
                // 제목이 없으면 본문 첫 줄 사용
                const title = item.title || item.contents?.split('\n')[0]?.substring(0, 50) || "새로운 소식";
                const link = `https://game.naver.com/lounge/chzzk/board/detail/${postId}`;

                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 공식 알림",
                    avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                    embeds: [{
                        title: `[${item.boardName || "알림"}] ${title}`,
                        url: link,
                        color: 0x00FFA3,
                        footer: { text: "치지직 공식 피드" },
                        timestamp: new Date()
                    }]
                });
                
                console.log(`[발송 성공] ${title}`);
                newIds.push(postId);
                hasNewUpdate = true;
                await sleep(1500); 
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: [...new Set(newIds)].slice(-50) }, null, 2));
            console.log("기록 저장 완료.");
        }

    } catch (err) {
        console.error('에러 발생 위치:', err.config?.url);
        console.error('에러 메시지:', err.message);
    }
}

checkChzzkOfficialFeed();
