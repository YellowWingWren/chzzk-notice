const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkNotice() {
    try {
        let lastIds = {};
        if (fs.existsSync(FILE_PATH)) {
            const fileContent = fs.readFileSync(FILE_PATH, 'utf8');
            lastIds = fileContent ? JSON.parse(fileContent) : {};
        }

        // [핵심 변경] API 주소 뒤에 타임스탬프를 붙여 '매번 새로운 요청'처럼 보이게 합니다.
        const timestamp = Date.now();
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15&_=${timestamp}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Origin': 'https://game.naver.com',
                'Referer': 'https://game.naver.com/lounge/chzzk/board/1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        // 응답이 HTML인지 JSON인지 먼저 확인합니다.
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.log("네이버가 아직도 봇으로 의심하여 HTML 페이지를 보냈습니다.");
            return;
        }

        const data = response.data?.data;
        const contents = data?.contents || data?.items || (Array.isArray(data) ? data : null);
        
        if (!contents || !Array.isArray(contents)) {
            console.log("데이터 주머니를 찾지 못했습니다.");
            return;
        }
        
        let hasNewUpdate = false;

        for (const post of [...contents].reverse()) {
            const category = post.boardName || "공지사항"; 
            const postId = post.postId;
            const title = post.title;

            if (!postId) continue;

            if (!lastIds[category] || postId > lastIds[category]) {
                console.log(`새 글 발견! [${category}] ${title}`);

                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 [${category}] 새 소식: ${title}`,
                        url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                        color: 0x00ff00,
                        footer: { text: "치지직 알림 도우미" },
                        timestamp: new Date()
                    }]
                });

                lastIds[category] = postId;
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새 소식 업데이트 완료!");
        } else {
            console.log("새로 올라온 소식이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
