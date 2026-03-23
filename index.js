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

        // 치지직 라운지 전체 게시글 API
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        const response = await axios.get(url);
        
        if (!response.data.data || !response.data.data.contents) {
            console.log("데이터를 가져오지 못했습니다.");
            return;
        }
        
        const posts = response.data.data.contents;
        let hasNewUpdate = false;

        // 역순으로 처리 (오래된 글부터 알림)
        for (const post of [...posts].reverse()) {
            const category = post.boardName; 
            const postId = post.postId;
            const title = post.title;

            // [조건 완전 해제] 
            // 이전에 저장된 해당 카테고리의 ID보다 크기만 하면 무조건 발송!
            if (!lastIds[category] || postId > lastIds[category]) {
                
                console.log(`새 글 발견: [${category}] ${title} (ID: ${postId})`);

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
            console.log("last_ids.json 업데이트 완료!");
        } else {
            console.log("새로 올라온 게시글이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
