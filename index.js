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

        // 최신 게시글 15개를 가져옵니다.
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        const response = await axios.get(url);
        
        if (!response.data.data || !response.data.data.contents) {
            console.log("데이터를 가져오는 데 실패했습니다.");
            return;
        }
        
        const posts = response.data.data.contents;
        let hasNewUpdate = false;

        // 오래된 글부터 하나씩 체크 (역순)
        for (const post of [...posts].reverse()) {
            const category = post.boardName; // 실제 카테고리 이름
            const postId = post.postId;
            const title = post.title;

            // [조건 완전 해제] 
            // 이 카테고리에서 처음 보는 번호이거나, 저장된 번호보다 크면 무조건 발송!
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
            console.log("새로운 소식을 업데이트했습니다.");
        } else {
            console.log("새로 올라온 공식 게시글이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
