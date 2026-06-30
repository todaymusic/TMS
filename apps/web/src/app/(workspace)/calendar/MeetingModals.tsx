"use client";

import { useState } from "react";
import { api, driveLink, type Meeting } from "@/lib/api";

function fmtDate(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export function MeetingCreateModal({
  authorId,
  defaultDate,
  onClose,
  onCreated,
}: {
  authorId?: string;
  defaultDate: string; // YYYY-MM-DD
  onClose: () => void;
  onCreated: (m: Meeting) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [driveFileId, setDriveFileId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const m = await api.post<Meeting>("/meetings", {
        title: title.trim() || undefined,
        date: new Date(date).toISOString(),
        driveFileId: driveFileId.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        transcriptUrl: transcriptUrl.trim() || undefined,
        transcriptText: transcriptText.trim() || undefined,
        announce: true,
        authorId,
      });
      onCreated(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", padding: 22 }}>
        <div className="sec-title mb16"><span className="em">📹</span> 회의 만들기</div>
        <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>날짜</label>
            <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label>제목 (비우면 AI 자동)</label>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="비우면 트랜스크립트로 AI 생성" />
          </div>
        </div>
        <div className="assign-field">
          <label>구글드라이브 파일 ID (영상/트랜스크립트)</label>
          <input className="inp" value={driveFileId} onChange={(e) => setDriveFileId(e.target.value)} placeholder="예: 1EArkUcSnvLRVjTI3FVRBG_8q0BE8RD5g" />
        </div>
        <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>영상 링크 (선택)</label>
            <input className="inp" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label>트랜스크립트 링크 (선택)</label>
            <input className="inp" value={transcriptUrl} onChange={(e) => setTranscriptUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="assign-field">
          <label>트랜스크립트 붙여넣기 (AI 제목·개요 생성)</label>
          <textarea className="inp" value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder="구글밋 트랜스크립트 전문을 붙여넣으면, AI가 2~3단어 제목 + 회의 개요를 만들고 전체공지에 올려요." style={{ minHeight: 140 }} />
        </div>
        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={create} disabled={busy}>
            {busy ? "생성·AI 정리 중…" : "회의 만들기 + 전체공지"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MeetingDetailModal({
  meeting,
  onClose,
  onChanged,
}: {
  meeting: Meeting;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState(meeting);
  const [showTr, setShowTr] = useState(false);
  const video = m.videoUrl || driveLink(m.driveFileId);
  const transcript = m.transcriptUrl || driveLink(m.driveFileId);

  async function resummarize() {
    setBusy(true);
    try {
      const updated = await api.post<Meeting>(`/meetings/${m.id}/summarize`, {});
      setM(updated);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm("이 회의를 삭제할까요?")) return;
    setBusy(true);
    try {
      await api.del(`/meetings/${m.id}`);
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 24 }}>
        <div className="panel-head">
          <div className="sec-title"><span className="em">📹</span> {m.title}</div>
          <span className="pill gray" style={{ marginLeft: "auto" }}>{fmtDate(m.date)}</span>
        </div>

        <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
          {video && <a className="btn" href={video} target="_blank" rel="noreferrer">▶ 영상 보기</a>}
          {transcript && <a className="btn" href={transcript} target="_blank" rel="noreferrer">📄 트랜스크립트</a>}
        </div>

        <div className="field-lbl" style={{ marginBottom: 6 }}>🤖 AI 회의 개요</div>
        {m.summary ? (
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "var(--text-2)", padding: "12px 14px", background: "var(--surface-2,#fafafa)", borderRadius: 8 }}>
            {m.summary}
          </div>
        ) : (
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>
            개요가 없어요. {m.transcriptText ? "AI 재요약을 눌러보세요." : "트랜스크립트가 없습니다."}
          </div>
        )}

        {m.transcriptText && (
          <div style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => setShowTr((s) => !s)}>
              {showTr ? "트랜스크립트 숨기기" : "트랜스크립트 원문 보기"}
            </button>
            {showTr && (
              <div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "var(--text-3)", marginTop: 8, maxHeight: 240, overflow: "auto", padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
                {m.transcriptText}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button className="btn sm" style={{ color: "#dc2626" }} onClick={remove} disabled={busy}>삭제</button>
          {m.transcriptText && (
            <button className="btn sm" onClick={resummarize} disabled={busy}>{busy ? "처리 중…" : "🤖 AI 재요약"}</button>
          )}
          <button className="btn primary" style={{ marginLeft: "auto" }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "grid",
  placeItems: "center",
  zIndex: 50,
  padding: 20,
};
