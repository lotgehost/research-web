"use client";

import { useEffect, useState, useCallback } from "react";

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

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch("/api/docs");
      const json: DocsResponse = await res.json();
      setData(json);
      setLastSync(new Date());
    } catch {
      // 네트워크 에러 시 기존 데이터 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoc();
    const timer = setInterval(fetchDoc, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchDoc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm animate-pulse">문서를 불러오는 중...</div>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="text-red-600 font-medium mb-2">연결 오류</p>
          <p className="text-red-500 text-sm">{data.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div
        className="doc-content"
        dangerouslySetInnerHTML={{ __html: data?.html ?? "" }}
      />
      {lastSync && (
        <div className="mt-16 pt-4 border-t border-gray-100 text-xs text-gray-400 text-right">
          Updated {lastSync.toLocaleTimeString("ko-KR")}
        </div>
      )}
    </div>
  );
}
