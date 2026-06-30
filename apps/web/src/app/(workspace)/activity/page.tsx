"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type Leave, type Priority, type Task, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import TaskDetailModal from "@/components/TaskDetailModal";

const PRI: Record<Priority, { label: string; bg: string; fg: string }> = {
  urgent: { label: "긴급", bg: "#fee2e2", fg: "#b91c1c" },
  high: { label: "높음", bg: "#ffedd5", fg: "#c2410c" },
  medium: { label: "보통", bg: "#e0e7ff", fg: "#4338ca" },
  low: { label: "낮음", bg: "#f1f5f9", fg: "#64748b" },
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const LEAVE_KO: Record<string, string> = {
  annual: "연차",
  half: "반차",
  quarter: "반반차",
  sick: "병가",
  etc: "기타",
};

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
  const [userLeaves, setUserLeaves] = useState<Leave[]>([]);
  const [targetUser, setTargetUser] = useState<User | null>(null);
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
  // 날짜 이동(어제/오늘/내일) · 상세 모달 · 퇴근 알림
  const [dayOffset, setDayOffset] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [endAlarm, setEndAlarm] = useState(false);

  async function load() {
    if (!me || !targetId) return;
    setErr(null);
    try {
      const [t, lv] = await Promise.all([
        api.get<Task[]>(`/tasks?assigneeId=${targetId}`),
        api.get<Leave[]>(`/leaves?userId=${targetId}`),
      ]);
      setTasks(t);
      setUserLeaves(lv);
      if (isSelf) {
        setNotifs(await api.get<Notif[]>(`/notifications?userId=${me.id}`));
        setTargetName(me.name);
        setTargetUser(me);
      } else {
        // 다른 사람 보기: 이름·근무시간 조회
        const users = await api.get<User[]>("/users");
        const u = users.find((x) => x.id === targetId) ?? null;
        setTargetUser(u);
        setTargetName(u?.name ?? "");
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

  // 선택 날짜(마감일 기준) 할일
  const selDate = new Date();
  selDate.setDate(selDate.getDate() + dayOffset);
  const selKey = ymd(selDate);
  const dayLabel = dayOffset === 0 ? "오늘" : dayOffset === -1 ? "어제" : dayOffset === 1 ? "내일" : `${selDate.getMonth() + 1}/${selDate.getDate()}`;
  const dayTasks = tasks.filter((t) => {
    if (t.dueDate) return ymd(new Date(t.dueDate)) === selKey;
    return dayOffset === 0; // 마감일 없는 건 오늘에 표시
  });
  const doingCount = tasks.filter((t) => stateOf(t) === "doing").length;

  // 마감 임박(2일 이내 미완료)
  const now = new Date();
  const soon = tasks
    .filter((t) => t.dueDate && stateOf(t) !== "done")
    .map((t) => ({ t, days: Math.ceil((new Date(t.dueDate!).getTime() - now.getTime()) / 86400000) }))
    .filter((x) => x.days <= 2)
    .sort((a, b) => a.days - b.days);

  // ───── 스케줄(오늘): 계획 + 실제 + 근태 ─────
  const todayKey = ymd(new Date());
  const work = { start: targetUser?.workStart, end: targetUser?.workEnd };
  const todayLeave = userLeaves.find((l) => {
    if (l.status !== "approved") return false;
    const s = new Date(l.startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(l.endDate); e.setHours(23, 59, 59, 999);
    return now >= s && now <= e;
  });
  const actual = tasks
    .filter((t) => t.startedAt && ymd(new Date(t.startedAt)) === todayKey)
    .map((t) => ({ t, s: new Date(t.startedAt!), e: t.endedAt ? new Date(t.endedAt) : null }))
    .sort((a, b) => a.s.getTime() - b.s.getTime());
  const concurrent = (i: number) => {
    const a = actual[i];
    const ae = a.e ?? now;
    return actual.some((b, j) => j !== i && a.s < (b.e ?? now) && b.s < ae);
  };
  const planned = tasks.filter(
    (t) => stateOf(t) === "todo" && (!t.dueDate || ymd(new Date(t.dueDate)) === todayKey),
  );

  // 퇴근 5분 전 알림(본인, workEnd 설정 시, 앱 열려있을 때)
  useEffect(() => {
    if (!isSelf || !me?.workEnd) return;
    const check = () => {
      const [h, m] = (me.workEnd ?? "").split(":").map(Number);
      if (Number.isNaN(h)) return;
      const d = new Date();
      const mins = (h * 60 + m) - (d.getHours() * 60 + d.getMinutes());
      setEndAlarm(mins > 0 && mins <= 5);
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [isSelf, me?.workEnd]);

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

        {/* 퇴근 5분 전 알림 */}
        {isSelf && endAlarm && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
              padding: "12px 16px", background: "#fef3c7", borderRadius: 10, fontSize: 14, fontWeight: 600,
            }}
          >
            ⏰ 곧 퇴근이에요! 진행 중인 업무의 <b>진행률을 기입</b>해주세요~
          </div>
        )}

        {/* 마감 임박 배너 */}
        {soon.length > 0 && (
          <div className="card" style={{ marginBottom: 14, padding: "12px 16px", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>⏳ 마감 임박</div>
            <div style={{ display: "grid", gap: 4 }}>
              {soon.map(({ t, days }) => (
                <div
                  key={t.id}
                  onClick={() => setDetailId(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}
                >
                  <span className="pill" style={{ background: days <= 0 ? "#fee2e2" : "#fef3c7", color: days <= 0 ? "#b91c1c" : "#a16207" }}>
                    {days < 0 ? `D+${-days}` : days === 0 ? "D-Day" : `D-${days}`}
                  </span>
                  <span style={{ flex: 1 }}>{t.title}</span>
                  {t.project && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{t.project.name}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="act-cols">
          {/* 좌: 체크리스트 + 멘션 피드 */}
          <div style={{ display: "grid", gap: 18 }}>
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">✅</span> 할일 체크리스트
                </div>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <button className="btn sm" onClick={() => setDayOffset((d) => d - 1)}>◀</button>
                  <b style={{ fontSize: 13, minWidth: 64, textAlign: "center" }}>
                    {dayLabel} ({selDate.getMonth() + 1}/{selDate.getDate()})
                  </b>
                  <button className="btn sm" onClick={() => setDayOffset((d) => d + 1)}>▶</button>
                  {dayOffset !== 0 && (
                    <button className="btn sm" onClick={() => setDayOffset(0)}>오늘</button>
                  )}
                </span>
              </div>
              <div className="chklist">
                {loading && (
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                    불러오는 중…
                  </div>
                )}
                {!loading && dayTasks.length === 0 && (
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                    {dayLabel} 마감 업무가 없어요.
                  </div>
                )}
                {dayTasks.map((it) => {
                  const st = stateOf(it);
                  const output =
                    [it.reportRequired ? "📊" : "", it.videoRequired ? "🎥" : ""]
                      .filter(Boolean)
                      .join("") || "—";
                  return (
                    <div
                      key={it.id}
                      className={`chk-item ${st}`}
                      onClick={() => setDetailId(it.id)}
                      style={{ cursor: "pointer", flexWrap: "wrap" }}
                      title="클릭하면 상세 보기"
                    >
                      <input
                        type="checkbox"
                        checked={st !== "todo"}
                        readOnly
                        style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                      />
                      <span
                        className="pill"
                        style={{ background: PRI[it.priority].bg, color: PRI[it.priority].fg, fontSize: 11 }}
                      >
                        {PRI[it.priority].label}
                      </span>
                      <span className={`ct${st === "done" ? " s" : ""}`}>{it.title}</span>
                      <span className="meta">{output}</span>
                      {isSelf && st === "todo" && (
                        <button
                          className="btn sm"
                          onClick={(e) => { e.stopPropagation(); start(it.id); }}
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
                            onClick={(e) => { e.stopPropagation(); openEnd(it); }}
                            disabled={busy === it.id}
                          >
                            종료
                          </button>
                          )}
                        </>
                      )}
                      {st === "done" && <span className="meta">완료 ✓</span>}
                      {it.statusMemo && (
                        <div style={{ flexBasis: "100%", fontSize: 12, color: "var(--text-3)", paddingLeft: 24 }}>
                          📝 {it.statusMemo}
                        </div>
                      )}
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
                  <span className="em">📅</span> 오늘 스케줄
                </div>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
                  {work.start && work.end ? `근무 ${work.start}~${work.end}` : "근무시간 미설정"}
                </span>
              </div>
              <div style={{ padding: 14, display: "grid", gap: 14 }}>
                {todayLeave && (
                  <div style={{ padding: "8px 12px", background: "#dcfce7", borderRadius: 8, fontSize: 13, color: "#15803d" }}>
                    🌴 오늘은 휴가 ({LEAVE_KO[todayLeave.type]})
                  </div>
                )}

                {/* 계획 */}
                <div>
                  <div className="field-lbl" style={{ marginBottom: 6 }}>📋 계획 (오늘 할 일)</div>
                  {planned.length === 0 ? (
                    <div style={{ color: "var(--text-3)", fontSize: 13 }}>계획된 할 일이 없어요.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      {planned.map((t) => (
                        <div key={t.id} onClick={() => setDetailId(t.id)} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                          <span className="pill" style={{ background: PRI[t.priority].bg, color: PRI[t.priority].fg, fontSize: 10 }}>
                            {PRI[t.priority].label}
                          </span>
                          <span style={{ flex: 1 }}>{t.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 실제 */}
                <div>
                  <div className="field-lbl" style={{ marginBottom: 6 }}>✅ 실제 (처리 타임라인)</div>
                  {actual.length === 0 ? (
                    <div style={{ color: "var(--text-3)", fontSize: 13 }}>아직 시작한 업무가 없어요.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {actual.map((a, i) => (
                        <div key={a.t.id} onClick={() => setDetailId(a.t.id)} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                          <span className="pill gray" style={{ minWidth: 92, textAlign: "center", fontSize: 11 }}>
                            {hm(a.s.toISOString())}~{a.e ? hm(a.e.toISOString()) : "진행"}
                          </span>
                          <span style={{ flex: 1 }}>{a.t.title}</span>
                          {concurrent(i) && (
                            <span className="pill" style={{ background: "#fef9c3", color: "#a16207", fontSize: 10 }}>⚡동시</span>
                          )}
                          {!a.e && <span className="pill" style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: 10 }}>진행중</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

      {detailId && (
        <TaskDetailModal
          taskId={detailId}
          readOnly={!isSelf}
          onClose={() => setDetailId(null)}
          onSaved={() => {
            setDetailId(null);
            void load();
          }}
        />
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
