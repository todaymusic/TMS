"use client";

import { useState } from "react";
import { api } from "@/lib/api";

type Summary = {
  decisions?: string[];
  progress?: string[];
  open?: string[];
  generatedAt?: string;
} | null;

export default function AiSummaryCard({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Summary;
}) {
  const [summary, setSummary] = useState<Summary>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function summarize() {
    setBusy(true);
    setErr(null);
    try {
      const s = await api.post<Summary>(`/ai/project-summary/${projectId}`, {});
      setSummary(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요약 실패");
    } finally {
      setBusy(false);
    }
  }

  const section = (title: string, items?: string[]) =>
    items && items.length > 0 ? (
      <div className="ai-block">
        <div className="h">{title}</div>
        <ul>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      </div>
    ) : null;

  const upd = summary?.generatedAt
    ? new Date(summary.generatedAt).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="card ai-card" style={{ marginBottom: 0 }}>
      <div className="ai-head">
        <span className="pill teal">🤖 AI 소통 요약</span>
        {upd && <span className="upd">마지막 갱신 · {upd}</span>}
        <button
          className="btn sm"
          style={{ marginLeft: "auto" }}
          onClick={summarize}
          disabled={busy}
        >
          {busy ? "요약 중…" : "지금 요약"}
        </button>
      </div>
      {err && (
        <div className="ai-block" style={{ color: "#dc2626", fontSize: 13 }}>
          {err}
        </div>
      )}
      {!summary && !err && (
        <div className="ai-block" style={{ color: "var(--text-3)", fontSize: 13 }}>
          아직 AI 요약이 없습니다. 대화가 쌓이면 «지금 요약»으로 생성하세요.
        </div>
      )}
      {summary && (
        <>
          {section("1) 핵심 결정사항", summary.decisions)}
          {section("2) 진행 상황", summary.progress)}
          {section("3) 미결 이슈 / 액션아이템", summary.open)}
        </>
      )}
    </div>
  );
}
