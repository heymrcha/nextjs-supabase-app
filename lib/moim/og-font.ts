/**
 * OG 이미지용 한글 글꼴. `ImageResponse`의 기본 글꼴에는 한글이 없어 그대로 두면
 * 두부(□)로 나온다. 이미지에 실제로 쓰는 글자만 Google Fonts에 `text=`로 요청해
 * 수 KB짜리 서브셋을 받는다 — 전체 Jua(수 MB)를 저장소에 커밋하지 않기 위해서다.
 *
 * `"use cache"`: cacheComponents 모드에서 캐시되지 않은 fetch는 이미지 라우트를
 * 요청 시점 생성으로 바꾼다. 캐시해 두어야 빌드 때 정적 PNG로 한 번만 만들어진다.
 */
export async function loadJuaSubset(text: string): Promise<ArrayBuffer> {
  "use cache";

  const cssUrl = `https://fonts.googleapis.com/css2?family=Jua&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();

  // 브라우저 UA가 없으면 Google Fonts가 truetype URL을 준다 — satori는 woff2를 읽지 못한다
  const fontUrl = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
  )?.[1];
  if (!fontUrl) {
    throw new Error("Jua 글꼴 URL을 찾지 못했습니다");
  }

  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(`Jua 글꼴을 받지 못했습니다 (${response.status})`);
  }
  return response.arrayBuffer();
}
