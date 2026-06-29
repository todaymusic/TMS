"use client";

import { useEffect, useState } from "react";
import { api, type Task, type User } from "@/lib/api";

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

export default function ActivityPage() {
  const [me, setMe] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const users = await api.get<User[]>("/users");
      const meUser = users[0] ?? null;
      setMe(meUser);
      if (meUser) {
        const [t, n] = await Promise.all([
          api.get<Task[]>(`/tasks?assigneeId=${meUser.id}`),
          api.get<Notif[]>(`/notifications?userId=${meUser.id}`),
        ]);
        setTasks(t);
        setNotifs(n);
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
  }, []);

  async function start(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/start`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function finish(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/end`, {});
      await load();
    } finally {
      setBusy(null);
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
          <h1>내 활동</h1>
          <div className="sub">
            {me ? `${me.name} · ` : ""}오늘 할일 · 멘션 피드 · 스케줄
          </div>
        </div>
      </div>

      <div className="content">
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
                      {st === "todo" && (
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
                          <button
                            className="btn sm"
                            onClick={() => finish(it.id)}
                            disabled={busy === it.id}
                          >
                            종료
                          </button>
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

            {/* 멘션 & 소통 피드 */}
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📨</span> 멘션 &amp; 소통 피드
                </div>
                <span className="count">
                  새 알림 {notifs.filter((n) => !n.read).length}
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
                  <div key={n.id} className={`feed-item${n.read ? "" : " unread"}`}>
                    <div className={`feed-ic ${ic.cls}`}>{ic.ic}</div>
                    <div>
                      <div className="feed-txt">{n.content}</div>
                      <div className="feed-time">{ago(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 우: 내 스케줄 + 이번 주 통계 */}
          <div style={{ display: "grid", gap: 18 }}>
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📅</span> 내 스케줄 — 오늘
                </div>
              </div>
              <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                스케줄 기능은 준비 중이에요. (캘린더/스케줄 데이터 모델 추후)
              </div>
            </div>

            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📊</span> 내 업무 통계
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
    </>
  );
}
