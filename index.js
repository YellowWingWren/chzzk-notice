const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkChzzkNotice() {
    try {
        // 1. 기존 기록 불러오기
        let lastData = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastData = JSON.parse(content || '{"notice":[]}');
        }

        // 2. 치지직 공식 라운지 공지사항 API (직접 호출)
        const loungeUrl = "https://apis.naver.com/game_api/game_api/v1/lounge/chzzk/board/15/posts?page=1&size=10";
        console.log("치지직 공지사항 확인 중...");
        
        const res = await axios.get(loungeUrl);
        const posts = res.data.data.items || [];
        
        let newIds = [...lastData.notice];
        let hasNewUpdate = false;

        // 3. 게시글 분석
        for (const post of posts) {
            const postId = String(post.postId);
            const title = post.title;
            const link = `https://game.naver.com/lounge/chzzk/board/detail/${postId}`;

            // 새로운 글인지 확인
            if (!lastData.notice.includes(postId)) {
                console.log(`[신규 발견] ${title}`);
                
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 공식 공지사항`,
                        description: `**${title}**`,
                        url: link,
                        color: 0x00FFA3,
                        footer: { text: "Chzzk Notice Bot" },
                        timestamp: new Date()
                    }]
                });
                
                newIds.push(postId);
                hasNewUpdate = true;
            }
        }

        // 4. 변화가 있을 때만 파일 저장
        if (hasNewUpdate) {
            // 중복 제거 및 최신 50개 유지
            const finalIds = [...new Set(newIds)].slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify({ notice: finalIds }, null, 2));
            console.log("파일 업데이트 완료: " + finalIds.length + "개 저장됨");
        } else {
            console.log("새로운 공지가 없습니다.");
        }

    } catch (err) {
        console.error('오류 발생:', err.message);
    }
}

checkChzzkNotice();
