import express from "express";
import cors from "cors";
import xml2js from "xml2js";
import fetch from "node-fetch";
import path from "path";
import googleTTS from "google-tts-api";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.static("public")); // 정적 파일 제공

let lastNews = "뉴스 로딩 중...";
const parser = new xml2js.Parser({ explicitArray: false });

// 제외할 카테고리 ID
const EXCLUDE_CATEGORIES = [
  "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", // 헤드라인
  "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRNU0FtdHZLQUFQAQ?hl=ko&gl=KR&ceid=KR:ko", //대한민국
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //세계
  "https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvTkwyY3ZNVEZpWXpaM2FHNHhiaElDYTI4b0FBUAE?hl=ko&gl=KR&ceid=KR:ko", //지역/서울
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //비즈니스
  "https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvSkwyMHZNR1ptZHpWbUVnSnJieG9DUzFJb0FBUAE?hl=ko&gl=KR&ceid=KR:ko", //과학/기술
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //엔터테인먼트
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //스포츠
  "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtdHZLQUFQAQ?hl=ko&gl=KR&ceid=KR:ko" //건강
];

// 가져올 카테고리 RSS URL (IT/과학, 스포츠 제외)
const CATEGORY_RSS = [
  "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko", // 헤드라인
  "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRNU0FtdHZLQUFQAQ?hl=ko&gl=KR&ceid=KR:ko", //대한민국
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //세계
  "https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvTkwyY3ZNVEZpWXpaM2FHNHhiaElDYTI4b0FBUAE?hl=ko&gl=KR&ceid=KR:ko", //지역/서울
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //비즈니스
  "https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvSkwyMHZNR1ptZHpWbUVnSnJieG9DUzFJb0FBUAE?hl=ko&gl=KR&ceid=KR:ko", //과학/기술
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //엔터테인먼트
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko", //스포츠
  "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtdHZLQUFQAQ?hl=ko&gl=KR&ceid=KR:ko" //건강
];

// RSS fetch + parse
async function fetchRSS(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    const result = await parser.parseStringPromise(xml);
    const items = Array.isArray(result.rss.channel.item)
      ? result.rss.channel.item
      : [result.rss.channel.item];
    return items;
  } catch (err) {
    console.error("RSS fetch/parse 실패:", url, err);
    return [];
  }
}

// 전체 뉴스 가져오기
async function fetchAllNews() {
  try {
    const promises = CATEGORY_RSS.map(url => fetchRSS(url));
    const results = await Promise.all(promises);
    const allItems = results.flat();
    lastNews = allItems.map(i => i.title).join("   |   ");
    console.log(`✅ 총 뉴스 ${allItems.length}개 가져옴`);
  } catch (err) {
    console.error("전체 뉴스 가져오기 실패", err);
    lastNews = "뉴스 로딩 실패 😢";
  }
}

// 초기 로드 + 50분마다 갱신
fetchAllNews();
setInterval(fetchAllNews, 3000000);

// 뉴스 JSON
app.get("/news", (req, res) => {
  res.json({ news: lastNews });
});

// 🎵 TTS mp3 직접 합쳐서 스트리밍
app.get("/news-tts", async (req, res) => {
  try {
    const text = lastNews;

    // 구글 TTS 분할 URL 생성
    const urls = googleTTS.getAllAudioUrls(text, {
      lang: "ko",
      slow: false,
    });

    // 각 조각을 fetch해서 Buffer로 변환
    const parts = await Promise.all(
      urls.map(async (u) => {
        const r = await fetch(u.url);
        const buf = await r.arrayBuffer();
        return Buffer.from(buf);
      })
    );

    // Buffer 합치기
    const merged = Buffer.concat(parts);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": merged.length,
    });
    res.send(merged);

  } catch (err) {
    console.error("TTS 생성 실패", err);
    res.status(500).send("TTS 생성 실패 😢");
  }
});

// 루트
app.get("/", (req, res) => 
  res.sendFile(path.join(process.cwd(), "public/index.html"))
);

app.listen(PORT, () => 
  console.log(`✅ Server running on port ${PORT}`)
);
