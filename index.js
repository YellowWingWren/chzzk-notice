const axios = require('axios');
const fs = require('fs');

const CLIENT_ID = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkChzzkNotice() {
    try {
        // 1. 기존 기록 불러오기
        let lastIds = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastIds = content ? JSON.parse(content) : { notice: [] };
        }

        // 2. 네이버 검색 API 호출 (공식적인 길)
        // 키워드: 치지직 라운지 게시판의 글들을 검색합니다.
        const query = encodeURIComponent('site:game.naver.com/lounge/chzzk/board/detail');
        const url = `https://openapi.naver.com/v1/search/webkr.json?query=${query}&display=20&sort=sim`;

        console.log("네이버 검색 API 호출 중...");
        const res = await axios.get(url, {
            headers: {
                'X-Naver-Client-Id': CLIENT_ID,
                'X-Naver-Client-Secret': CLIENT_SECRET
            }
        });

        const items = res.data.items || [];
        let hasNew = false;

        // 3. 검색 결과 분석
        for (const item of items) {
            const link = item.link;
            // 링크에서 게시글 ID 추출 (예: .../detail/12345 -> 12345)
            const match = link.match(/detail\/(\d+)/);
            if (!match) continue;
            
            const postId = match[1];
            const cleanTitle = item.title.replace(/<[^>]*>?/gm, ''); // HTML 태그 제거

            // 이미 알림을 보낸 글인지 확인
            if (!lastIds.notice.includes(postId)) {
                console.log(`[신규 게시글 발견] ${cleanTitle}`);

                // 4. 디스코드 전송
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 라운지 신규 소식 (공식 검색)`,
                        description: `**${cleanTitle}**\n\n${item.description.replace(/<[^>]*>?/gm, '')}`,
                        url: link,
                        color: 0x00FFA3,
                        footer: { text: "Naver Official Search API" },
                        timestamp: new Date()
                    }]
                });

                lastIds.notice.push(postId);
                hasNew = true;
            }
        }

        // 5. 결과 저장
        if (hasNew) {
            lastIds.notice = lastIds.notice.slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새 소식 알림 완료.");
        } else {
            console.log("새로운 소식이 검색되지 않았습니다.");
        }

    } catch (err) {
        console.error('API 실행 중 오류 발생:', err.message);
        if (err.response && err.response.status === 401) {
            console.error("오류: API 키가 올바르지 않습니다. GitHub Secrets를 확인해 주세요.");
        }
    }
}

checkChzzkNotice();
