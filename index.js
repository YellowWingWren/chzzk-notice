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

        // [목표] 치지직 라운지 게시판 전체 글 목록 API
        // 이 주소가 사용자님이 말씀하신 '게시판' 데이터를 담고 있습니다.
        const url = `https://game.naver.com/lounge/chzzk/api/board/v1/posts/all?page=1&pageSize=20`;
        
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://game.naver.com/lounge/chzzk/board/1',
                'Accept': 'application/json, text/plain, */*'
            }
        });

        // 네이버 게시판 API의 표준 데이터 구조
        const posts = res.data?.data?.contents;

        if (!posts || !Array.isArray(posts)) {
            console.log("게시판 데이터를 불러오지 못했습니다. (보안 차단 가능성)");
            return;
        }

        let hasNew = false;
        // 최신순으로 오기 때문에 뒤집어서 옛날 글부터 처리
        for (const post of [...posts].reverse()) {
            const postId = String(post.postId);
            const title = post.title;
            const writer = post.writer?.nickname || ""; // 작성자 닉네임

            // [필터링] 작성자가 '치지직'이거나, 공식 마크(isOfficial)가 있거나, 
            // 공지 카테고리인 경우만 수집 (일반인 글 차단)
            const isOfficial = post.isOfficial === true || writer.includes('치지직') || post.boardName === '공지사항';

            if (isOfficial && !lastIds.notice.includes(postId)) {
                console.log(`[공식 게시글 발견] ${title}`);
                
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 라운지 공식 공지`,
                        description: `**${title}**\n작성자: ${writer}`,
                        url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                        color: 0x00FFA3,
                        footer: { text: "Chzzk Board Monitor" },
                        timestamp: new Date()
                    }]
                });
                
                lastIds.notice.push(postId);
                hasNew = true;
            }
        }

        if (hasNew) {
            lastIds.notice = lastIds.notice.slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새로운 공식 게시글 알림 완료.");
        } else {
            console.log("새로운 공식 게시글이 없습니다.");
        }

    } catch (err) {
        console.error('실행 중 오류:', err.message);
    }
}

checkNotice();
