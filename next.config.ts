import type { NextConfig } from "next";

/**
 * 메타데이터를 스트리밍하지 않고 <head>에 넣어 줄 봇 목록. Next 기본 목록
 * (next/dist/shared/lib/router/utils/html-bots.js)에 카카오톡 스크래퍼가 없어서,
 * 그대로 두면 카톡 미리보기에 모임 제목 대신 기본 문구가 뜬다. 기본값을 내부 경로에서
 * import하면 Next 업그레이드 때 조용히 깨질 수 있어 문자열을 옮겨 적고 끝에 추가한다.
 */
const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|kakaotalk-scrap/i;

const nextConfig: NextConfig = {
  cacheComponents: true,
  htmlLimitedBots: HTML_LIMITED_BOTS,
};

export default nextConfig;
