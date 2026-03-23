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

        // 지적하신 대로 '/1'을 제거하여 전체 게시판을 타겟팅합니다.
        const targetUrl = 'https://game.naver.com/lounge/chzzk/board';
        
        const res = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Cache-Control': 'no-cache'
            }
        });

        const html = res.data;
        // 네이버의 서버 사이드 렌더링 데이터(JSON) 추출
        const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
        
        if (!dataMatch) {
            console.log("페이지 데이터를 분석할 수 없습니다. (구조 변경 또는 차단)");
            return;
        }

        const jsonData = JSON.parse(dataMatch[1]);
        
        // 전체 게시판 목록 데이터 경로 (네이버의 최신 구조 반영)
        const posts = jsonData.props?.pageProps?.initialState?.board?.posts?.contents || 
                      jsonData.props?.pageProps?.initialState?.feed?.posts?.contents || [];

        if (posts.length === 0) {
            console.log("현재 게시판에서 글 목록을 찾을 수 없습니다.");
            return;
        }

        let hasNewUpdate = false;
        // 최신순으로 정렬된 데이터를 과거 순으로 뒤집어서 처리
        for (const post of [...posts].reverse()) {
            const postId = String(post.postId);
            const title = post.title;
            const writerNickname = post.writer?.nickname || "";
            
            // [필터링 핵심] 
            // 1. 작성자 닉네임에 '치지직'이 들어감 
            // 2. 혹은 네이버에서 공식 인증한 'isOfficial' 마크가 붙음
            const isOfficialPost = post.isOfficial === true || writerNickname.includes('치지직');

            if (isOfficialPost && !lastIds.notice.includes(postId)) {
                console.log(`[공식 게시글 발견] ${title}`);
                
                await axios.post(DISCORD_WEBHOOK, {
                    embeds: [{
                        title: `📢 치지직 라운지 공식 소식`,
                        description: `**${title}**\n\n작성자: ${writerNickname}`,
                        url: `https://game.naver.com/lounge/chzzk/board/detail/${postId}`,
                        color: 0x00FFA3,
                        footer: { text: "Chzzk Official Monitor" },
                        timestamp: new Date()
                    }]
                });
                
                lastIds.notice.push(postId);
                hasNewUpdate = true;
            }
        }

        if (hasNewUpdate) {
            lastIds.notice = lastIds.notice.slice(-50);
            fs.writeFileSync(FILE_PATH, JSON.stringify(lastIds, null, 2));
            console.log("새 소식 알림 전송 및 기록 업데이트 완료.");
        } else {
            console.log("새로운 공식 소식이 없습니다.");
        }

    } catch (err) {
        console.error('실행 중 오류:', err.message);
    }
}

checkNotice();
