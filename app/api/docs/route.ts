import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  const docId = process.env.GOOGLE_DOC_ID;

  if (!docId) {
    return NextResponse.json(
      { error: "GOOGLE_DOC_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
    const res = await fetch(exportUrl, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `문서를 가져올 수 없습니다 (${res.status}).` },
        { status: res.status }
      );
    }

    const html = await res.text();

    // 레이아웃 오버라이드 CSS를 </head> 앞에 삽입
    const injectedHtml = html.replace(
      "</head>",
      `<style>
        body { margin: 0 !important; padding: 60px 80px 96px !important; max-width: 800px !important; font-family: Georgia, serif !important; background: #fff !important; }
        p { margin-top: 0 !important; margin-bottom: 0.85em !important; line-height: 1.75 !important; font-size: 15px !important; }
        span { line-height: inherit !important; font-size: inherit !important; }
        /* 구글 독스 빈 줄 높이 고정 */
        p:has(> span:only-child:empty) { display: none !important; }
        table { width: 100% !important; border-collapse: collapse; margin: 1.5em 0 !important; }
        td, th { padding: 10px 14px !important; vertical-align: top; }
      </style>
      </head>`
    );

    return NextResponse.json({ html: injectedHtml, updatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
