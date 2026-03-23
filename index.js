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

        // [정석 주소] 치지직 라운지의 공식 공지/이벤트 등을 통합해서 가져오는 API입니다.
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=15`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://game.naver.com/lounge/chzzk/home'
            }
        });

        // 네이버 게임 라운지 API 표준 구조로 접근
        const contents = response.data?.data?.contents;
        
        if (!contents || !Array.isArray(contents)) {
            // 만약 또 HTML이 온다면, 주소를 약간 우회하는 API로 한 번 더 시도합니다.
            console.log("일반 API 차단 확인, 우회 API로 재시도합니다...");
            return await tryBackupApi(lastIds);
        }
        
        await processPosts(contents, lastIds);

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

async function tryBackupApi(lastIds) {
    const backupUrl = `https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners`; // 홈 배너/공지 API
    try {
        const res = await axios.get(backupUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log("우회 API 응답 성공");
        // 이 구조는 배너 형태라 postId 추출 방식이 다를 수 있지만, 일단 연결 확인이 우선입니다.
    } catch (e) {
        console.log("우회 API마저 차단되었습니다.");
    }
}

async function processPosts(posts, lastIds) {
    let hasNewUpdate = false;
    for (const post of [...posts].reverse()) {
        const category = post.boardName || "공지";
        const postId = post.postId;
        const title = post.title;

        if (!lastIds[category] || postId > lastIds[category]) {
            console.log(`새 글 발견: [${category}] ${title}`);
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
    }
}

checkNotice();
