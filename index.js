const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkChzzkNotice() {
    try {
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        // 치지직 공식 라운지 공지사항 API
        const loungeUrl = "https://apis.naver.com/game_api/game_api/v1/lounge/chzzk/board/15/posts?page=1&size=10";
        console.log("치지직 공식 공지사항 확인 중...");
        
        const res = await axios.get(loungeUrl);
        
        // 데이터 구조 안전하게 접근 (에러 방지)
        const posts = (res.data && res.data.data && res.data.data.items) ? res.data.data.items : [];
        
        if (posts.length === 0) {
            console.log("가져온 공지사항 데이터가 없습니다.");
            return;
        }

        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        for (const post of posts) {
            const postId = String(post.postId);
            const title = post.title;
            const link = `https://game.naver.com/lounge/chzzk/board/detail/${postId}`;

            if (!lastData.notice.includes(postId)) {
                console.log(`[신규 발견] ${title}`);
                
                await axios.post(DISCORD_WEBHOOK, {
                    username: "치지직 알림이",
                    avatar_url: "https://ssl.pstatic.net/static/nng/glive/icon_192.png",
                    embeds: [{
                        title: `📢 치지직 공식 공지사항`,
                        description: `**${title}**`,
                        url: link,
                        color: 0x00FFA3,
                        timestamp: new Date()
                    }]
                });
                
                newIds.push(postId);
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            const finalIds = [...new Set(newIds)].slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: finalIds }, null, 2));
            console.log(`파일 업데이트 완료: ${finalIds.length}개 저장됨`);
        } else {
            console.log("새로운 공지가 없습니다.");
        }

    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkChzzkNotice();
