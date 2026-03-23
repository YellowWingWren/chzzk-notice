const axios = require('axios');
const fs = require('fs');

// 환경 변수 및 설정
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const FILE_PATH = './last_ids.json';

async function checkNotice() {
    try {
        // 1. 기존 알림 기록 불러오기
        let lastIds = { notice: [] };
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            try {
                lastIds = content ? JSON.parse(content) : { notice: [] };
            } catch (e) {
                lastIds = { notice: [] };
            }
        }
        if (!Array.isArray(lastIds.notice)) lastIds.notice = [];

        // 2. 관리자 전용 배너 API 호출 (일반 유저 글이 섞이지 않는 청정 구역)
        const url = `https://apis.naver.com/game_api/lounge/chzzk/api/v1/home/banners`;
        const res = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://game.naver.com/lounge/chzzk/home'
            }
        });

        const rawData = res.data;
        let items = [];

        // 3. 재귀적 탐색으로 '공식 링크'와 '제목' 쌍을 추출
        const deepSearch = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) { obj.forEach(deepSearch); return; }

            // 데이터의 필드명을 추측하지 않고, 내용물의 특성(URL+텍스트)으로 판단
            const values = Object.values(obj);
            const link = values.find(v => typeof v === 'string' && (v.startsWith('http') || v.startsWith('/lounge/chzzk')));
            const title = obj.title || obj.bannerName || obj.text || values.find(v => typeof v === 'string' && v.length >= 5 && !v.startsWith('http'));

            if (link && title) {
                // [이중 보안] 링크가 치지직 공식 경로를 포함할 때만 수집 (일반 글 차단)
                const isOfficial = link.includes('chzzk') || link.includes('naver.me') || link.includes('game.naver.com');
                
                if (isOfficial) {
                    const fullLink = link.startsWith('http') ? link : `https://game.naver.com${link}`;
                    const id = String(obj.bannerId || obj.id || title);
                    items.push({ id, title: String(title).trim(), link: fullLink.trim() });
                }
            }
            Object.values(obj).forEach(deepSearch);
        };
        deepSearch(rawData);

        // 4. 새로운 소식 필터링 및 디스코드 전송
        let hasNew = false;
        const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());

        for (const item of uniqueItems) {
            // 이미 보낸 알림인지 확인
            if (!lastIds.notice.includes(item.id)) {
                console.log(`[신규 공지 발견] ${item.title}`);
                
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 공식 새로운 소식`,
                        description: `**${item.title}**`,
                        url: item.link,
                        color: 0x00FFA3, 
                        footer: { text: "Chzzk Official Notice Service" },
                        timestamp: new Date()
                    }]
                });
                
                lastIds.notice.push(item.id);
                hasNew = true;
            }
        }

        // 5. 결과 저장 (최신 50개 유지)
        if (hasNew) {
            lastIds.notice = lastIds.notice.slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새 소식 알림 발송 완료 및 기록 저장.");
        } else {
            console.log("업데이트된 새로운 공식 소식이 없습니다.");
        }

    } catch (err) {
        console.error('실행 중 오류 발생:', err.message);
    }
}

checkNotice();
