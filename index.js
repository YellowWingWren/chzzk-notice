const axios = require('axios');
const fs = require('fs');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkNotice() {
    try {
        let lastIds = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            lastIds = content ? JSON.parse(content) : { notice: [] };
        }

        // 성공 확인된 배너 API
        const url = `https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners`;
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
        });

        const rawData = res.data;
        let items = [];

        // [구조적 탐색] 이름이 무엇이든 "내용물"의 특징으로 찾습니다.
        const deepSearch = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) { obj.forEach(deepSearch); return; }

            // 1. 객체의 모든 값을 검사합니다.
            const values = Object.values(obj);
            
            // 2. "http"로 시작하는 링크가 있고, "10자 이상의 긴 텍스트"가 있는 객체를 찾습니다.
            const hasLink = values.some(v => typeof v === 'string' && v.startsWith('http'));
            const hasLongText = values.some(v => typeof v === 'string' && v.length >= 10);
            
            if (hasLink && hasLongText) {
                // 가장 긴 텍스트를 제목으로, http 주소를 링크로 자동 할당
                const potentialTitle = values.find(v => typeof v === 'string' && v.length >= 10);
                const potentialLink = values.find(v => typeof v === 'string' && v.startsWith('http'));
                const potentialId = String(obj.id || obj.bannerId || potentialTitle);

                items.push({ id: potentialId, title: potentialTitle, link: potentialLink });
            }
            
            // 더 깊이 탐색
            values.forEach(deepSearch);
        };
        deepSearch(rawData);

        if (items.length === 0) {
            console.log("데이터를 분석하지 못했습니다. 응답 샘플:", JSON.stringify(rawData).substring(0, 300));
            return;
        }

        let hasNew = false;
        // 중복 제거 (탐색 중 여러 번 걸릴 수 있음)
        const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

        for (const item of uniqueItems) {
            if (!lastIds.notice.includes(item.id)) {
                console.log(`[새 소식 전송] ${item.title}`);
                await axios.post(DISCORD_WEBHOOK, {
                    content: `📢 **치지직 새 소식**\n\n**제목**: ${item.title}\n**링크**: ${item.link}`
                });
                lastIds.notice.push(item.id);
                hasNew = true;
            }
        }

        if (hasNew) {
            lastIds.notice = lastIds.notice.slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
        } else {
            console.log("새로운 소식이 없습니다.");
        }

    } catch (err) {
        console.error('실행 오류:', err.message);
    }
}

checkNotice();
