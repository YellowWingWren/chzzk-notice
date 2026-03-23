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

        // [최종 병기] 모바일 전용 API 주소와 강력한 위장 헤더를 사용합니다.
        const url = `https://apis.naver.com/game_api/lounge/chzzk/board/v1/posts/all?page=1&pageSize=15`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Referer': 'https://m.game.naver.com/lounge/chzzk/board/1',
                'Origin': 'https://m.game.naver.com',
                'Cookie': 'NID_AUT=dummy; NID_SES=dummy;' // 가짜 쿠키라도 넣어 봇 판정을 피합니다.
            }
        });

        // JSON 데이터인지 확인
        let contents;
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.log("여전히 HTML 페이지가 반환되었습니다. 네이버의 차단이 매우 강력합니다.");
            return;
        } else {
            // 모바일 API는 구조가 조금 다를 수 있어 유연하게 체크합니다.
            contents = response.data?.data?.contents || response.data?.contents || response.data?.data?.items;
        }
        
        if (!contents || !Array.isArray(contents)) {
            console.log("데이터를 찾을 수 없습니다. 응답 상태:", response.status);
            return;
        }
        
        let hasNewUpdate = false;

        for (const post of [...contents].reverse()) {
            const category = post.boardName || "알림"; 
            const postId = post.postId;
            const title = post.title;

            if (!postId) continue;

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
            console.log("새 소식 업데이트 완료!");
        } else {
            console.log("새로 올라온 소식이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
        if (error.response && error.response.data) {
            console.log("에러 데이터 일부:", JSON.stringify(error.response.data).substring(0, 100));
        }
    }
}

checkNotice();
