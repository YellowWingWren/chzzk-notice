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

        // 보안 검사가 가장 느슨한 홈 배너/공지 API를 다시 사용합니다.
        const backupUrl = `https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners`;
        const res = await axios.get(backupUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        // [데이터 자동 추출] 어떤 구조로 오든 배열을 찾아냅니다.
        const rawData = res.data;
        let foundItems = [];

        function findItems(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                // 제목(title)과 ID 혹은 링크가 있는 객체 배열을 찾습니다.
                const validItems = obj.filter(item => item && (item.title || item.bannerId || item.id));
                if (validItems.length > 0) {
                    foundItems = validItems;
                    return;
                }
            }
            for (const key in obj) {
                if (foundItems.length > 0) break;
                findItems(obj[key]);
            }
        }
        findItems(rawData);

        if (foundItems.length === 0) {
            console.log("유효한 데이터를 찾지 못했습니다. 전체 응답:", JSON.stringify(rawData).substring(0, 200));
            return;
        }

        let hasNewUpdate = false;

        for (const item of [...foundItems].reverse()) {
            // 고유 ID 생성 (없으면 제목을 ID 대용으로 사용)
            const itemId = String(item.bannerId || item.id || item.title);
            const title = item.title || "제목 없음";
            const link = item.linkUrl || item.url || `https://game.naver.com/lounge/chzzk/home`;

            if (!lastIds["notice"] || !lastIds["notice"].includes(itemId)) {
                console.log(`새 소식 발견: ${title}`);

                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 새 소식: ${title}`,
                        url: link,
                        color: 0x00ff00,
                        footer: { text: "치지직 알림" },
                        timestamp: new Date()
                    }]
                });

                if (!lastIds["notice"]) lastIds["notice"] = [];
                lastIds["notice"].push(itemId);
                // 너무 많아지지 않게 최근 20개만 유지
                if (lastIds["notice"].length > 20) lastIds["notice"].shift();
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("알림 발송 및 업데이트 완료!");
        } else {
            console.log("이미 처리된 소식입니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
