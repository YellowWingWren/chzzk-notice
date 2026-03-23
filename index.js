const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function fetchWithRetry(url, referer) {
    return await axios.get(url, {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': referer,
            'Origin': 'https://game.naver.com'
        }
    });
}

async function checkNotice() {
    try {
        let lastIds = fs.existsSync(FILE_PATH) ? JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')) : { notice: [] };
        if (!Array.isArray(lastIds.notice)) lastIds.notice = [];

        // 1순위: 게시판 API / 2순위: 홈 배너 API (보험)
        const targets = [
            { url: 'https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=10', ref: 'https://game.naver.com/lounge/chzzk/board/1' },
            { url: 'https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners', ref: 'https://game.naver.com/lounge/chzzk/home' }
        ];

        let rawData = null;
        for (const target of targets) {
            try {
                const res = await fetchWithRetry(target.url, target.ref);
                if (res.data && typeof res.data === 'object') {
                    rawData = res.data;
                    console.log(`성공 주소: ${target.url}`);
                    break; 
                }
            } catch (e) { console.log(`시도 실패: ${target.url}`); }
        }

        if (!rawData) throw new Error("모든 API 접근에 실패했습니다.");

        // 데이터 내부에서 게시글(ID와 제목이 있는 배열) 자동 검색
        let items = [];
        const scan = (obj) => {
            if (items.length > 0 || !obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                const candidates = obj.filter(i => i && (i.postId || i.bannerId || i.id) && i.title);
                if (candidates.length > 0) { items = candidates; return; }
            }
            Object.values(obj).forEach(scan);
        };
        scan(rawData);

        if (items.length === 0) {
            console.log("알림을 보낼 데이터를 찾지 못했습니다.");
            return;
        }

        let hasNew = false;
        for (const item of [...items].reverse()) {
            const id = String(item.postId || item.bannerId || item.id);
            const title = item.title;
            const link = item.postId ? `https://game.naver.com/lounge/chzzk/board/detail/${id}` : (item.linkUrl || item.url);

            if (!lastIds.notice.includes(id)) {
                console.log(`새 글 전송: ${title}`);
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 소식: ${title}`,
                        url: link || 'https://game.naver.com/lounge/chzzk/home',
                        color: 0x31A2FF,
                        footer: { text: "Chzzk Notice Bot" },
                        timestamp: new Date()
                    }]
                });
                lastIds.notice.push(id);
                hasNew = true;
            }
        }

        if (hasNew) {
            lastIds.notice = lastIds.notice.slice(-30); // 최신 30개만 유지
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
        }

    } catch (err) {
        console.error('최종 오류:', err.message);
    }
}

checkNotice();
