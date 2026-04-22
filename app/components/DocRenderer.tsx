"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Heading = { id: string; text: string };

type DocsResponse = {
  css?: string;
  body?: string;
  headings?: Heading[];
  updatedAt?: string;
  error?: string;
};

const POLL_INTERVAL = 30_000;

export default function DocRenderer() {
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeId, setActiveId] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      const json: DocsResponse = await res.json();
      setData(json);
      setLastSync(new Date());
    } catch {
      // 기존 데이터 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoc();
    const timer = setInterval(fetchDoc, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchDoc]);

  // 스크롤 감지 — 헤딩 id 기준
  useEffect(() => {
    observerRef.current?.disconnect();
    if (!data?.headings?.length) return;

    const els = data.headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    if (!els.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-600 font-medium mb-2">Connection error</p>
          <p className="text-red-500 text-sm">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex" style={{ fontFamily: "Georgia, serif" }}>

      {/* Google Docs 스코핑된 CSS + 레이아웃 오버라이드 */}
      <style dangerouslySetInnerHTML={{ __html: `
        ${data?.css ?? ""}

        #gdoc p {
          line-height: 2.0 !important;
          margin-top: 0 !important;
          margin-bottom: 1em !important;
          font-size: 15px !important;
        }
        #gdoc span {
          line-height: inherit !important;
          font-size: inherit !important;
        }
        /* 빈 줄 제거 */
        #gdoc p:not(:has(> [id])):empty { display: none !important; }
        #gdoc p > span:only-child:empty + p { display: none !important; }
      `}} />

      {/* 왼쪽 TOC — 30% */}
      <aside
        className="sticky top-0 h-screen overflow-y-auto shrink-0 pt-16 pl-10 pr-6"
        style={{ width: "30%" }}
      >
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-6 font-sans">Contents</p>
        <nav className="flex flex-col gap-1">
          {(data?.headings ?? []).map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              className="group flex items-start gap-2.5 py-1 transition-colors text-sm font-sans"
              style={{ color: activeId === h.id ? "#111" : "#aaa" }}
            >
              <span
                className="mt-2 block h-px shrink-0 transition-all duration-200"
                style={{
                  width: activeId === h.id ? 20 : 12,
                  background: activeId === h.id ? "#111" : "#ccc",
                }}
              />
              <span className="leading-snug">{h.text}</span>
            </a>
          ))}
        </nav>

        {lastSync && (
          <p className="mt-auto pt-8 text-[10px] text-gray-300 font-sans">
            Updated {lastSync.toLocaleTimeString("ko-KR")}
          </p>
        )}
      </aside>

      {/* 가운데 여백 — 10% */}
      <div style={{ width: "10%" }} />

      {/* 오른쪽 본문 — 60% */}
      <main className="pt-16 pb-24 pr-16" style={{ width: "60%" }}>
        <div
          id="gdoc"
          dangerouslySetInnerHTML={{ __html: data?.body ?? "" }}
        />
      </main>
    </div>
  );
}
