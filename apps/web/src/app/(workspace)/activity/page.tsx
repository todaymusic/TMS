"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type Task, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Notif = {
  id: string;
  type: string;
  content: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const FEED_IC: Record<string, { cls: string; ic: string }> = {
  mention: { cls: "mention", ic: "@" },
  task: { cls: "task", ic: "📋" },
  system: { cls: "sys", ic: "⚠️" },
};

function hm(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ago(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function ActivityInner() {
  const { user: me } = useAuth();
  const sp = useSearchParams();
  const viewId = sp.get("userId");
  const isSelf = !viewId || viewId === me?.id;
  const targetId = viewId || me?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [targetName, setTargetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // 업무 종료 산출물 입력 모달
  const [endTask, setEndTask] = useState<Task | null>(null);
  const [endReport, setEndReport] = useState("");
  const [endVideo, setEndVideo] = useState("");
  const [endNote, setEndNote] = useState("");
  const [endBusy, setEndBusy] = useState(false);

  async function load() {
    if (!me || !targetId) return;
    setErr(null);
    try {
      const t = await api.get<Task[]>(`/tasks?assigneeId=${targetId}`);
      setTasks(t);
      if (isSelf) {
        setNotifs(await api.get<Notif[]>(`/notifications?userId=${me.id}`));
        setTargetName(me.name);
      } else {
        // 다른 사람 보기: 이름 조회
        const users = await api.get<User[]>("/users");
        setTargetName(users.find((u) => u.id === targetId)?.name ?? "");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, viewId]);

  async function start(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/start`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }
  function openEnd(t: Task) {
    setEndTask(t);
    setEndReport(t.reportLink ?? "");
    setEndVideo(t.videoLink ?? "");
    setEndNote("");
  }
  async function submitEnd() {
    if (!endTask) return;
    setEndBusy(true);
    try {
      await api.post(`/tasks/${endTask.id}/end`, {
        reportLink: endReport.trim() || undefined,
        videoLink: endVideo.trim() || undefined,
        note: endNote.trim() || undefined,
      });
      setEndTask(null);
      await load();
    } finally {
      setEndBusy(false);
    }
  }

  async function markRead(id: string) {
    setNotifs((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.patch(`/notifications/${id}/read`, {});
    } catch {
      /* noop */
    }
  }
  async function markAllRead() {
    if (!me) return;
    setNotifs((cur) => cur.map((n) => ({ ...n, read: true })));
    try {
      await api.patch(`/notifications/read-all?userId=${me.id}`, {});
    } catch {
      /* noop */
    }
  }

  const stateOf = (t: Task): "todo" | "doing" | "done" =>
    t.status === "done" || t.status === "completed_pending"
      ? "done"
      : t.status === "doing"
        ? "doing"
        : "todo";

  const cnt = {
    done: tasks.filter((t) => stateOf(t) === "done").length,
    doing: tasks.filter((t) => stateOf(t) === "doing").length,
    todo: tasks.filter((t) => stateOf(t) === "todo").length,
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{isSelf ? "내 활동" : `${targetName || "팀원"}님의 활동`}</h1>
          <div className="sub">
            {isSelf
              ? `${me?.name ?? ""} · 오늘 할일 · 멘션 피드 · 스케줄`
              : "오늘 할일 · 스케줄 · 업무 통계 (읽기 전용)"}
          </div>
        </div>
      </div>

      <div className="content">
        {!isSelf && (
          <Link href="/dashboard" className="detail-back">
            ← 대시보드로
          </Link>
        )}
        {err && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {err}
          </div>
        )}
        <div className="act-cols">
          {/* 좌: 체크리스트 + 멘션 피드 */}
          <div style={{ display: "grid", gap: 18 }}>
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">✅</span> 오늘 할일 체크리스트
                </div>
              </div>
              <div className="chklist">
                {loading && (
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                    불러오는 중…
                  </div>
                )}
                {!loading && tasks.length === 0 && (
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                    부여된 업무가 없어요.
                  </div>
                )}
                {tasks.map((it) => {
                  const st = stateOf(it);
                  const output =
                    [it.reportRequired ? "📊" : "", it.videoRequired ? "🎥" : ""]
                      .filter(Boolean)
                      .join("") || "—";
                  return (
                    <div key={it.id} className={`chk-item ${st}`}>
                      <input
                        type="checkbox"
                        checked={st !== "todo"}
                        readOnly
                        style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                      />
                      <span className={`ct${st === "done" ? " s" : ""}`}>{it.title}</span>
                      <span className="meta">{output}</span>
                      {isSelf && st === "todo" && (
                        <button
                          className="btn sm"
                          onClick={() => start(it.id)}
                          disabled={busy === it.id}
                        >
                          시작
                        </button>
                      )}
                      {st === "doing" && (
                        <>
                          <span className="meta">⏱ {hm(it.dueDate)}</span>
                          {isSelf && (
                          <button
                            className="btn sm"
                            onClick={() => openEnd(it)}
                            disabled={busy === it.id}
                          >
                            종료
                          </button>
                          )}
                        </>
                      )}
                      {st === "done" && <span className="meta">완료 ✓</span>}
                    </div>
                  );
                })}
              </div>
              <div className="hint" style={{ padding: "0 18px 16px" }}>
                체크(시작) → 대시보드에 진행중 표시 · 종료 → 완료 처리 (산출물 입력 폼 추후)
              </div>
            </div>

            {/* 멘션 & 소통 피드 (본인만) */}
            {isSelf && (
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📨</span> 멘션 &amp; 소통 피드
                </div>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="count">
                    새 알림 {notifs.filter((n) => !n.read).length}
                  </span>
                  {notifs.some((n) => !n.read) && (
                    <button className="btn sm" onClick={markAllRead}>
                      모두 읽음
                    </button>
                  )}
                </span>
              </div>
              {!loading && notifs.length === 0 && (
                <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                  아직 알림이 없어요.
                </div>
              )}
              {notifs.map((n) => {
                const ic = FEED_IC[n.type] ?? FEED_IC.system;
                return (
                  <div
                    key={n.id}
                    className={`feed-item${n.read ? "" : " unread"}`}
                    onClick={() => !n.read && markRead(n.id)}
                    style={{ cursor: n.read ? "default" : "pointer" }}
                    title={n.read ? "" : "클릭하면 읽음 처리"}
                  >
                    <div className={`feed-ic ${ic.cls}`}>{ic.ic}</div>
                    <div>
                      <div className="feed-txt">{n.content}</div>
                      <div className="feed-time">{ago(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* 우: 스케줄 + 업무 통계 */}
          <div style={{ display: "grid", gap: 18 }}>
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📅</span> 스케줄 — 마감 예정
                </div>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 8 }}>
                {tasks.filter((t) => t.dueDate && stateOf(t) !== "done").length === 0 && (
                  <div style={{ color: "var(--text-3)", fontSize: 13 }}>예정된 마감이 없어요.</div>
                )}
                {tasks
                  .filter((t) => t.dueDate && stateOf(t) !== "done")
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .map((t) => (
                    <div
                      key={t.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}
                    >
                      <span className="pill gray" style={{ minWidth: 64, textAlign: "center" }}>
                        {new Date(t.dueDate!).getMonth() + 1}/{new Date(t.dueDate!).getDate()}
                      </span>
                      <span style={{ flex: 1 }}>{t.title}</span>
                      <span className="meta" style={{ fontSize: 12, color: "var(--text-3)" }}>
                        {stateOf(t) === "doing" ? "진행중" : "대기"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📊</span> 업무 통계
                </div>
              </div>
              <div className="stats-row">
                <div className="stat">
                  <div className="num done">{cnt.done}</div>
                  <div className="lb">완료</div>
                </div>
                <div className="stat">
                  <div className="num prog">{cnt.doing}</div>
                  <div className="lb">진행중</div>
                </div>
                <div className="stat">
                  <div className="num wait">{cnt.todo}</div>
                  <div className="lb">대기</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {endTask && (
        <div
          onClick={() => !endBusy && setEndTask(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 460, padding: 22 }}
          >
            <div className="panel-head">
              <div className="sec-title">
                <span className="em">✅</span> 업무 종료 — {endTask.title}
              </div>
            </div>
            {!endTask.reportRequired && !endTask.videoRequired && (
              <div className="field-hint" style={{ marginBottom: 8 }}>
                이 업무는 산출물 요구가 없어요. 메모만 남기고 종료할 수 있습니다.
              </div>
            )}
            {endTask.reportRequired && (
              <div className="assign-field">
                <label>📊 보고링크</label>
                <input
                  className="inp"
                  value={endReport}
                  onChange={(e) => setEndReport(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
            {endTask.videoRequired && (
              <div className="assign-field">
                <label>🎥 설명영상 링크</label>
                <input
                  className="inp"
                  value={endVideo}
                  onChange={(e) => setEndVideo(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
            <div className="assign-field">
              <label>완료 메모 (선택)</label>
              <textarea
                className="inp"
                value={endNote}
                onChange={(e) => setEndNote(e.target.value)}
                placeholder="마무리 코멘트"
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => !endBusy && setEndTask(null)}
              >
                취소
              </button>
              <button
                className="btn primary"
                style={{ flex: 2 }}
                onClick={submitEnd}
                disabled={endBusy}
              >
                {endBusy ? "처리 중…" : "종료 처리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityInner />
    </Suspense>
  );
}
