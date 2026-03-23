const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

// 감시할 카테고리 목록 (이름이 정확해야 합니다)
const TARGET_CATEGORIES = ['공지사항', '업데이트', '같이보기 안내', '이벤트', '콘텐츠 제작 지원', 'EWC'];

async function checkNotice() {
    try {
        let lastIds = {};
        if (fs.existsSync(FILE_PATH)) {
            lastIds = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        }

        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        const response = await axios.get(url);
        
        if (!response.data.data || !response.data.data.contents) return;
        
        const posts = response.data.data.contents;
        let hasNewUpdate = false;

        // 최신순으로 정렬되어 있으므로, 역순으로 처리하여 옛날 글부터 알림을 보냅니다.
        for (const post of [...posts].reverse()) {
            const category = post.boardName;
            const postId = post.postId;

            // [수정된 조건] 
            // 1. 우리가 원하는 카테고리 목록에 포함되는지 확인
            // 2. 작성자가 매니저이거나, 공식 마크가 있거나, 혹은 카테고리 이름 자체가 '공식 소식' 영역인지 확인
            const isTargetCategory = TARGET_CATEGORIES.includes(category);
            
            if (isTargetCategory) {
                // 해당 카테고리의 마지막 저장된 번호보다 큰 경우만 새 글 처리
                if (!lastIds[category] || postId > lastIds[category]) {
                    
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
        }

    } catch (error) {
        console.error('체크 중 오류 발생:', error.message);
    }
}

checkNotice();
