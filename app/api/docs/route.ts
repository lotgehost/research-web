import { NextResponse } from "next/server";

export const revalidate = 30;

// Google Docs CSS 클래스를 #gdoc 안으로 스코핑
function scopeCss(css: string): string {
  return css
    .replace(/\.(c\d+)(\s*[,{])/g, "#gdoc .$1$2")
    .replace(/\.(lst-\S+?)(\s*[,{>])/g, "#gdoc .$1$2")
    .replace(/^(ol|ul|table)(\s*\{)/gm, "#gdoc $1$2")
    .replace(/^(td|th)(\s*,|\s*\{)/gm, "#gdoc $1$2")
    .replace(/li\.li-bullet-0/g, "#gdoc li.li-bullet-0");
}

// CSS에서 font-weight:700 클래스 추출
function findBoldClasses(css: string): Set<string> {
  const bold = new Set<string>();
  const matches = css.matchAll(/\.(c\d+)\s*\{[^}]*font-weight\s*:\s*700[^}]*\}/g);
  for (const m of matches) bold.add(m[1]);
  return bold;
}

// 굵은 텍스트만 있는 문단을 헤딩으로 추출
function extractHeadings(body: string, boldClasses: Set<string>): Array<{ id: string; text: string }> {
  const headings: Array<{ id: string; text: string }> = [];
  const paraRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = paraRe.exec(body)) !== null) {
    const inner = match[1];
    const text = inner.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
    if (!text || text.length > 120) continue;

    // 모든 span이 bold 클래스를 가지는지 확인
    const spans = [...inner.matchAll(/<span\b([^>]*)>/gi)];
    if (!spans.length) continue;
    const allBold = spans.every(([, attrs]) => {
      const cls = (attrs.match(/class="([^"]*)"/) ?? [])[1] ?? "";
      return cls.split(" ").some((c: string) => boldClasses.has(c));
    });

    if (allBold) {
      const id = `heading-${headings.length}`;
      headings.push({ id, text });
    }
  }
  return headings;
}

// 헤딩에 id 앵커 삽입
function injectHeadingIds(body: string, boldClasses: Set<string>): string {
  let idx = 0;
  return body.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
    if (!text || text.length > 120) return full;

    const spans = [...inner.matchAll(/<span\b([^>]*)>/gi)];
    if (!spans.length) return full;
    const allBold = spans.every(([, a]) => {
      const cls = (a.match(/class="([^"]*)"/) ?? [])[1] ?? "";
      return cls.split(" ").some((c: string) => boldClasses.has(c));
    });

    if (allBold) {
      const id = `heading-${idx++}`;
      return `<p id="${id}"${attrs}>${inner}</p>`;
    }
    return full;
  });
}

export async function GET() {
  const docId = process.env.GOOGLE_DOC_ID;
  if (!docId) {
    return NextResponse.json({ error: "GOOGLE_DOC_ID 환경변수가 없습니다." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=html`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `문서 가져오기 실패 (${res.status})` }, { status: res.status });
    }

    const html = await res.text();
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawCss = styleMatch?.[1] ?? "";
    const rawBody = bodyMatch?.[1] ?? html;

    const boldClasses = findBoldClasses(rawCss);
    const headings = extractHeadings(rawBody, boldClasses);
    const body = injectHeadingIds(rawBody, boldClasses);
    const css = scopeCss(rawCss);

    return NextResponse.json({ css, body, headings, updatedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
