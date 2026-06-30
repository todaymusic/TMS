"use client";

import { useRef, useState } from "react";
import { API_BASE, type Meeting } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Phase = "idle" | "recording" | "processing" | "done" | "error";

export default function MeetingRecorder() {
  const { user: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Meeting | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function reset() {
    setPhase("idle");
    setSecs(0);
    setErr(null);
    setResult(null);
  }

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => void upload();
      rec.start();
      recRef.current = rec;
      setPhase("recording");
      setSecs(0);
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      setErr("마이크 권한이 필요해요. 브라우저에서 허용해주세요.");
      setPhase("error");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("processing");
  }

  async function upload() {
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const token = typeof window !== "undefined" ? localStorage.getItem("tms_token") : null;
      const res = await fetch(`${API_BASE}/meetings/record?authorId=${me?.id ?? ""}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `오류 ${res.status}`);
      }
      const m = (await res.json()) as Meeting;
      setResult(m);
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 200) : "처리 실패");
      setPhase("error");
    }
  }

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <>
      <button
        className="btn"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        title="즉석 회의 녹음 → AI 회의록"
      >
        🎙 회의 시작
      </button>

      {open && (
        <div
          onClick={() => phase !== "recording" && phase !== "processing" && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 420, padding: 24, textAlign: "center" }}>
            <div className="sec-title mb16" style={{ justifyContent: "center" }}>
              <span className="em">🎙</span> 즉석 회의 녹음
            </div>

            {phase === "idle" && (
              <>
                <p style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.6 }}>
                  지금 바로 회의를 녹음해요. 종료하면 음성을 받아쓰고(화자분리) AI가 제목·개요를 만들어 <b>그날 회의</b>로 저장합니다.
                </p>
                <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={start}>
                  ● 녹음 시작
                </button>
              </>
            )}

            {phase === "recording" && (
              <>
                <div style={{ fontSize: 34, fontWeight: 800, color: "#dc2626", margin: "10px 0" }}>{mmss}</div>
                <div style={{ fontSize: 13, color: "var(--text-3)" }}>🔴 녹음 중…</div>
                <button className="btn primary" style={{ width: "100%", marginTop: 16 }} onClick={stop}>
                  ■ 회의 종료 + 회의록 생성
                </button>
              </>
            )}

            {phase === "processing" && (
              <div style={{ padding: 20, fontSize: 14, color: "var(--text-2)" }}>
                ⏳ 음성 인식 + AI 정리 중…<br />
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>회의가 길면 몇 분 걸릴 수 있어요.</span>
              </div>
            )}

            {phase === "done" && result && (
              <>
                <div style={{ fontSize: 30 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, margin: "8px 0" }}>{result.title}</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text-2)", textAlign: "left", maxHeight: 240, overflow: "auto", padding: 12, background: "var(--surface-2,#fafafa)", borderRadius: 8 }}>
                  {result.summary || "개요 없음"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>캘린더 📹 회의 탭에 저장됐어요.</div>
                <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setOpen(false)}>
                  완료
                </button>
              </>
            )}

            {phase === "error" && (
              <>
                <div style={{ color: "#dc2626", fontSize: 13.5, margin: "10px 0" }}>{err}</div>
                <button className="btn" style={{ width: "100%" }} onClick={reset}>
                  다시 시도
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
