const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_id.txt';

// [치지직 소식] 그룹에 해당하는 공식 게시판 ID 목록입니다.
// 라운지 구조에 따라 공식 게시판들만 순회합니다.
const OFFICIAL_BOARD_IDS = [1, 2, 3, 5, 8, 10]; 

async function checkNotice() {
    try {
        let lastId = 0;
        if (fs.existsSync(FILE_PATH)) {
            lastId = parseInt(fs.readFileSync(FILE_PATH, 'utf8')) || 0;
        }

        let maxIdInThisRun = lastId;

        for (const boardId of OFFICIAL_BOARD_IDS) {
            // 각 공식 게시판의 최신글을 가져옵니다.
            const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts?boardId=${boardId}&page=1&pageSize=5`;
            const response = await axios.get(url);
            
            if (!response.data.data || !response.data.data.contents) continue;
            
            const posts = response.data.data.contents;

            for (const post of posts) {
                const postId = post.postId;

                // 1. 이전에 읽은 글보다 최신글이어야 함
                // 2. 작성자가 '치지직' 공식 계정(Manager)인 경우만 발송
                if (postId > lastId && (post.writer.isManager || post.postTargetType === 'OFFICIAL')) {
                    
                    await axios.post(DISCORD_WEBHOOK, {
                        embeds: [{
                            title: `📢 치지직 소식: ${post.title}`,
                            description: `**카테고리:** ${post.boardName}`,
                            url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                            color: 0x00ff00, // 초록색 강조
                            footer: { text: "치지직 공식 알림" },
                            timestamp: new Date()
                        }]
                    });

                    if (postId > maxIdInThisRun) {
                        maxIdInThisRun = postId;
                    }
                }
            }
        }

        // 가장 높은 ID를 파일에 저장하여 중복 알림 방지
        if (maxIdInThisRun > lastId) {
            fs.writeFileSync(FILE_PATH, maxIdInThisRun.toString());
        }

    } catch (error) {
        console.error('데이터를 가져오는 중 오류 발생:', error.message);
    }
}

checkNotice();
