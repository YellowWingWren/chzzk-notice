const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkNotice() {
    try {
        let lastIds = {};
        if (fs.existsSync(FILE_PATH)) {
            lastIds = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        }

        // 전체 게시글 목록 가져오기
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        const response = await axios.get(url);
        
        if (!response.data.data || !response.data.data.contents) return;
        
        const posts = response.data.data.contents;
        let hasNewUpdate = false;

        // 옛날 글부터 처리 (역순)
        for (const post of [...posts].reverse()) {
            const category = post.boardName; // 실제 카테고리 이름
            const postId = post.postId;
            const isOfficial = post.postTargetType === 'OFFICIAL' || (post.writer && post.writer.isManager);

            // [핵심 로직] 공식 글(매니저 작성 등)이기만 하면 카테고리 상관없이 체크!
            if (isOfficial) {
                // 이 카테고리에 대해 저장된 번호가 없거나, 더 최신 글인 경우
                if (!lastIds[category] || postId > lastIds[category]) {
                    
                    console.log(`새 글 발견: [${category}] ${post.title}`);

                    await axios.post(DISCORD_WEBHOOK, {
                        embeds: [{
                            title: `📢 [${category}] 새 소식: ${post.title}`,
                            url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                            color: 0x00ff00,
                            footer: { text: "치지직 공식 알림" },
                            timestamp: new Date()
                        }]
                    });

                    lastIds[category] = postId;
                    hasNewUpdate = true;
                }
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("last_ids.json 업데이트 완료");
        } else {
            console.log("새로 올라온 공식 게시글이 없습니다.");
        }

    } catch (error) {
        console.error('체크 중 오류 발생:', error.message);
    }
}

checkNotice();
