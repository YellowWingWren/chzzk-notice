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

        // 모바일 API 주소는 보안이 유연하며 데이터 접근이 쉽습니다.
        const url = `https://apis.naver.com/game_api/lounge/chzzk/board/v1/posts/all?page=1&pageSize=15`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://m.game.naver.com/'
            }
        });

        // [데이터 자동 탐색] 어떤 이름의 주머니에 데이터가 들어있든 찾아냅니다.
        let posts = [];
        const findPosts = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj) && obj.length > 0 && obj[0].postId) {
                posts = obj;
                return;
            }
            for (const key in obj) {
                if (posts.length > 0) break;
                findPosts(obj[key]);
            }
        };
        findPosts(response.data);

        if (posts.length === 0) {
            console.log("게시글 배열을 찾을 수 없습니다. 응답 구조:", JSON.stringify(response.data).substring(0, 200));
            return;
        }
        
        let hasNewUpdate = false;

        // 역순으로 처리하여 옛날 글부터 알림
        for (const post of [...posts].reverse()) {
            const category = post.boardName || "치지직 소식";
            const postId = post.postId;
            const title = post.title;

            if (!lastIds[category] || postId > lastIds[category]) {
                console.log(`새 글 발견: [${category}] ${title}`);

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
            console.log("성공적으로 업데이트되었습니다!");
        } else {
            console.log("새로운 게시글이 없습니다.");
        }

    } catch (error) {
        console.error('오류 발생:', error.message);
    }
}

checkNotice();
