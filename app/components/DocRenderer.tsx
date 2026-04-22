"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type DocsResponse = {
  html?: string;
  updatedAt?: string;
  error?: string;
};

const POLL_INTERVAL = 30_000;

export default function DocRenderer() {
  const [data, setData] = useState<DocsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [iframeHeight, setIframeHeight] = useState(800);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // iframe 콘텐츠 높이에 맞게 자동 조절
  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const height = iframe.contentDocument?.body?.scrollHeight ?? 800;
      setIframeHeight(height + 40);
    } catch {
      // cross-origin 오류 무시
    }
  };

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
    <div className="min-h-screen bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={data?.html ?? ""}
        onLoad={handleIframeLoad}
        style={{ width: "100%", height: iframeHeight, border: "none", display: "block" }}
        title="Research Report"
      />
      {lastSync && (
        <div className="px-20 pb-8 text-xs text-gray-300 text-right">
          Updated {lastSync.toLocaleTimeString("ko-KR")}
        </div>
      )}
    </div>
  );
}
