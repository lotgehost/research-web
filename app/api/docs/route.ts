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
    // 공개 공유 문서는 export URL로 인증 없이 HTML 가져오기 가능
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
    const res = await fetch(exportUrl, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `문서를 가져올 수 없습니다 (${res.status}). 문서 공유 설정을 확인해 주세요.` },
        { status: res.status }
      );
    }

    const html = await res.text();
    return NextResponse.json({ html, updatedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
