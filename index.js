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

        // [주소 수정] 게시판 전용 API 주소로 변경하여 HTML 페이지가 아닌 실제 데이터를 가져옵니다.
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15&sort=NEW`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://game.naver.com/lounge/chzzk/board/1'
            }
        });
        
        // 데이터 구조 분석 (네이버 응답 구조에 맞춤)
        const contents = response.data?.data?.contents;
        
        if (!contents || !Array.isArray(contents)) {
            console.log("데이터 형식이 예상과 다릅니다. 현재 응답 상태:", response.status);
            return;
        }
        
        let hasNewUpdate = false;

        for (const post of [...contents].reverse()) {
            const category = post.boardName || "공지사항"; 
            const postId = post.postId;
            const title = post.title;

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
            console.log("last_ids.json 업데이트 완료!");
        } else {
            console.log("새로 올라온 공식 게시글이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
