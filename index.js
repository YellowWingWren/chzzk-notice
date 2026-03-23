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

        // 라운지 게시판의 데이터를 가져오는 API
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        // [데이터 주머니 찾기] contents가 없으면 대체 가능한 경로를 모두 뒤집니다.
        const data = response.data?.data;
        const contents = data?.contents || data?.items || data?.content || (Array.isArray(data) ? data : null);
        
        if (!contents || !Array.isArray(contents)) {
            console.log("데이터를 찾을 수 없습니다. 응답 구조 확인용:", JSON.stringify(response.data).substring(0, 300));
            return;
        }
        
        let hasNewUpdate = false;

        // 최신 글부터 꼼꼼히 확인
        for (const post of [...contents].reverse()) {
            const category = post.boardName || "공지사항"; 
            const postId = post.postId;
            const title = post.title;

            if (!postId) continue; // ID가 없는 데이터는 건너뜁니다.

            if (!lastIds[category] || postId > lastIds[category]) {
                console.log(`새 글 발견! [${category}] ${title}`);

                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 [${category}] 새 소식: ${title}`,
                        url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                        color: 0x00ff00,
                        footer: { text: "치지직 알림 시스템" },
                        timestamp: new Date()
                    }]
                });

                lastIds[category] = postId;
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새 소식 업데이트 및 파일 저장 완료!");
        } else {
            console.log("새로 올라온 소식이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
