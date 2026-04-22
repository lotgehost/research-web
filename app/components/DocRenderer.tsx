"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Section = {
  id: string;
  heading: string;
  html: string;
};

type ParsedDoc = {
  title: string;
  subtitle: string;
  sections: Section[];
};

type DocsResponse = {
  html?: string;
  updatedAt?: string;
  error?: string;
};

const POLL_INTERVAL = 30_000;

function parseDoc(html: string): ParsedDoc {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  const title = body.querySelector("h1")?.textContent?.trim() ?? "";
  body.querySelector("h1")?.remove();

  // h1 다음 첫 번째 p를 subtitle로 사용
  const firstP = body.querySelector("p");
  const subtitle = firstP?.textContent?.trim() ?? "";
  firstP?.remove();

  // 나머지를 h2 기준으로 섹션 분리
  const sections: Section[] = [];
  const children = Array.from(body.children);
  let current: Section | null = null;
  let buffer = "";

  for (const el of children) {
    if (el.tagName === "H2" || el.tagName === "H3") {
      if (current) {
        current.html = buffer;
        sections.push(current);
      }
      const heading = el.textContent?.trim() ?? "";
      const id = heading.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      current = { id, heading, html: "" };
      buffer = "";
    } else {
      buffer += el.outerHTML;
    }
  }
  if (current) {
    current.html = buffer;
    sections.push(current);
  }

  return { title, subtitle, sections };
}

const POLL = 30_000;

export default function DocRenderer() {
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeId, setActiveId] = useState<string>("");
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
    const timer = setInterval(fetchDoc, POLL);
    return () => clearInterval(timer);
  }, [fetchDoc]);

  // 스크롤 감지로 활성 섹션 표시
  useEffect(() => {
    observerRef.current?.disconnect();
    const sections = document.querySelectorAll("[data-section]");
    if (!sections.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute("data-section") ?? "");
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => observerRef.current?.observe(s));
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

  const bodyMatch = data?.html?.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : (data?.html ?? "");
  const parsed = parseDoc(bodyHtml);

  return (
    <div className="min-h-screen bg-white flex">

      {/* 좌측 고정 사이드바 */}
      <aside className="w-44 shrink-0 sticky top-0 h-screen flex flex-col pt-16 pl-8 pr-4">
        <nav className="flex flex-col gap-1 mt-2">
          {parsed.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`group flex items-center gap-2 text-xs transition-colors py-0.5 ${
                activeId === s.id ? "text-black" : "text-gray-400 hover:text-black"
              }`}
            >
              <span className={`block h-px transition-all ${
                activeId === s.id ? "w-5 bg-black" : "w-3 bg-gray-300 group-hover:w-5 group-hover:bg-black"
              }`} />
              {s.heading}
            </a>
          ))}
        </nav>

        {lastSync && (
          <div className="mt-auto pb-8 text-[10px] text-gray-300">
            Updated {lastSync.toLocaleTimeString("ko-KR")}
          </div>
        )}
      </aside>

      {/* 우측 본문 */}
      <main className="flex-1 pt-16 pb-24 pr-16 max-w-4xl">

        {/* 타이틀 */}
        {parsed.title && (
          <h1 className="text-5xl font-bold text-black mb-6 leading-tight tracking-tight">
            {parsed.title}
          </h1>
        )}

        {/* 서브타이틀 */}
        {parsed.subtitle && (
          <p className="text-3xl font-normal text-black mb-16 leading-snug max-w-2xl">
            — {parsed.subtitle}
          </p>
        )}

        {/* 섹션들 */}
        {parsed.sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            data-section={s.id}
            className="mb-16"
          >
            <h2 className="text-xl font-semibold text-black mb-6 pb-2 border-b border-gray-200">
              {s.heading}
            </h2>
            <div
              className="doc-content"
              dangerouslySetInnerHTML={{ __html: s.html }}
            />
          </section>
        ))}
      </main>
    </div>
  );
}
