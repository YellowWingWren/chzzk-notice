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

        // 방금 성공한 우회 API 주소
        const backupUrl = `https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners`;
        const res = await axios.get(backupUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://game.naver.com/lounge/chzzk/home'
            }
        });

        // 배너 데이터에서 공지글 정보 추출
        const banners = res.data?.data || [];
        if (banners.length === 0) {
            console.log("배너 데이터를 찾을 수 없습니다.");
            return;
        }

        let hasNewUpdate = false;

        for (const banner of [...banners].reverse()) {
            // 배너 데이터는 보통 id가 문자열이거나 다를 수 있어 고유값으로 처리합니다.
            const bannerId = String(banner.bannerId || banner.id);
            const title = banner.title;
            const link = banner.linkUrl || `https://game.naver.com/lounge/chzzk/home`;

            // '공지사항' 카테고리 하나로 묶어서 관리
            if (!lastIds["공지"] || bannerId !== String(lastIds["공지"])) {
                console.log(`새 소식 발견: ${title}`);

                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 새 소식: ${title}`,
                        url: link,
                        color: 0x00ff00,
                        footer: { text: "치지직 배너 알림" },
                        timestamp: new Date()
                    }]
                });

                lastIds["공지"] = bannerId;
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("업데이트 완료!");
        } else {
            console.log("새로운 소식이 없습니다.");
        }

    } catch (error) {
        console.error('실행 중 오류 발생:', error.message);
    }
}

checkNotice();
