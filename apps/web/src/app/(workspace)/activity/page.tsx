"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, progressColor, type Leave, type Priority, type Task, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import TaskDetailModal from "@/components/TaskDetailModal";
import TaskDocModal from "@/components/TaskDocModal";
import ScheduleBoard from "@/components/ScheduleBoard";
import ReviewModal from "./ReviewModal";

const PRI: Record<Priority, { label: string; bg: string; fg: string }> = {
  urgent: { label: "긴급", bg: "#fee2e2", fg: "#b91c1c" },
  high: { label: "높음", bg: "#ffedd5", fg: "#c2410c" },
  medium: { label: "보통", bg: "#e0e7ff", fg: "#4338ca" },
  low: { label: "낮음", bg: "#f1f5f9", fg: "#64748b" },
};

// 진행률에 따른 카드 배경(연한 톤) — progressColor 버킷과 동일
function progressBg(p: number): string {
  if (p <= 0) return "#f9fafb";
  if (p <= 25) return "#fef2f2";
  if (p <= 50) return "#fff7ed";
  if (p <= 75) return "#fefce8";
  if (p <= 99) return "#eff6ff";
  return "#f0fdf4";
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function mdd(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
  dm: { cls: "task", ic: "💬" },
  system: { cls: "sys", ic: "⚠️" },
};


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
  const [assigned, setAssigned] = useState<Task[]>([]);
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
  const [reviewTask, setReviewTask] = useState<Task | null>(null);
  const [endAlarm, setEndAlarm] = useState(false);
  // 내 업무 빠른 추가
  const [myAddOpen, setMyAddOpen] = useState(false);
  const [myTitle, setMyTitle] = useState("");
  const [myPrio, setMyPrio] = useState<Priority>("medium");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // 업무 리스트 → 오늘의 업무로 끌어오는 드래그
  const [listDragId, setListDragId] = useState<string | null>(null);
  // 업무설명 doc 새 창
  const [docTask, setDocTask] = useState<{ id: string; title: string } | null>(null);
  // 포스트잇 자유 메모(개인 · localStorage 저장)
  const [scratch, setScratch] = useState("");

  async function load() {
    if (!me || !targetId) return;
    setErr(null);
    try {
      const [t, lv, asg] = await Promise.all([
        api.get<Task[]>(`/tasks?assigneeId=${targetId}`),
        api.get<Leave[]>(`/leaves?userId=${targetId}`),
        api.get<Task[]>(`/tasks?assignerId=${targetId}`),
      ]);
      setTasks(t);
      setUserLeaves(lv);
      setAssigned(asg);
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

  // 포스트잇 메모 불러오기(본인)
  useEffect(() => {
    if (!me?.id) return;
    try {
      setScratch(localStorage.getItem(`tms_scratch_${me.id}`) ?? "");
    } catch {
      /* noop */
    }
  }, [me?.id]);
  function updateScratch(v: string) {
    setScratch(v);
    try {
      if (me?.id) localStorage.setItem(`tms_scratch_${me.id}`, v);
    } catch {
      /* noop */
    }
  }

  async function start(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/start`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function pause(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/pause`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function resume(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/resume`, {});
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

  async function addMyTask() {
    if (!me || !myTitle.trim()) return;
    setBusy("myadd");
    try {
      await api.post("/tasks", {
        title: myTitle.trim(),
        category: "shorts",
        priority: myPrio,
        status: "todo",
        assignerId: me.id,
        assigneeId: me.id,
        plannedDate: new Date().toISOString(), // 오늘의 업무에 바로
      });
      setMyTitle("");
      setMyAddOpen(false);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function accept(id: string) {
    setBusy(id);
    try {
      await api.post(`/tasks/${id}/accept`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }

  // '오늘 하기' 토글 (plannedDate=오늘 / 해제)
  async function planToday(id: string, on: boolean) {
    setBusy(id);
    try {
      await api.patch(`/tasks/${id}`, {
        plannedDate: on ? new Date().toISOString() : "",
      });
      await load();
    } finally {
      setBusy(null);
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
      : t.status === "doing" || t.status === "paused"
        ? "doing"
        : "todo";

  const cnt = {
    done: tasks.filter((t) => stateOf(t) === "done").length,
    doing: tasks.filter((t) => stateOf(t) === "doing").length,
    todo: tasks.filter((t) => stateOf(t) === "todo").length,
  };

  // 선택 날짜
  const selDate = new Date();
  selDate.setDate(selDate.getDate() + dayOffset);
  const selKey = ymd(selDate);
  const dayLabel = dayOffset === 0 ? "오늘" : dayOffset === -1 ? "어제" : dayOffset === 1 ? "내일" : `${selDate.getMonth() + 1}/${selDate.getDate()}`;
  const ddays = (t: Task) =>
    t.dueDate ? Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000) : Infinity;
  const todayStart0 = new Date();
  todayStart0.setHours(0, 0, 0, 0);
  const dateOnly = (s: string) => {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  // 오늘의 업무 = (오늘 이하로 계획된 미완료=이월) + 마감 D-3이내/지난 미완료 + 진행중. 마감 급한 순.
  const dayTasks = tasks
    .filter((t) => {
      // 남이 요청한 업무는 수락 전엔 오늘의 업무에서 제외
      if (t.assigner && t.assigner.id !== targetId && !t.acceptedAt) return false;
      if (dayOffset === 0) {
        // 오늘 이하로 '오늘 하기' 한 미완료 업무는 완료할 때까지 계속 이월
        const plannedCarry =
          !!t.plannedDate && dateOnly(t.plannedDate) <= todayStart0.getTime() && stateOf(t) !== "done";
        return (
          plannedCarry ||
          stateOf(t) === "doing" ||
          (stateOf(t) !== "done" && ddays(t) <= 3)
        );
      }
      // 어제/내일 보기: 그 날짜에 계획됐거나 마감인 것
      const planned = t.plannedDate && ymd(new Date(t.plannedDate)) === selKey;
      return planned || (t.dueDate && ymd(new Date(t.dueDate)) === selKey);
    })
    .sort((a, b) => {
      // 수동 순서(dayOrder) 우선, 없으면 마감 급한 순
      const oa = a.dayOrder ?? Infinity;
      const ob = b.dayOrder ?? Infinity;
      if (oa !== ob) return oa - ob;
      return ddays(a) - ddays(b);
    });

  // 현재 업무중 = 지금 시작해서 진행 중(doing)인 업무
  const currentTasks = tasks.filter((t) => t.status === "doing");
  // 오늘의 업무 = 오늘 계획됐지만 아직 진행중이 아닌 것(대기·중단)
  const todayList = dayTasks.filter((t) => t.status !== "doing");
  const todayIds = new Set(dayTasks.map((t) => t.id));

  // 드래그로 오늘의 업무 순서 변경
  async function reorderToday(toIdx: number) {
    const from = dragIdx;
    setDragIdx(null);
    if (from === null || from === toIdx) return;
    const arr = [...todayList];
    const [moved] = arr.splice(from, 1);
    arr.splice(toIdx, 0, moved);
    setTasks((cur) =>
      cur.map((t) => {
        const i = arr.findIndex((x) => x.id === t.id);
        return i >= 0 ? { ...t, dayOrder: i } : t;
      }),
    );
    await Promise.all(arr.map((t, i) => api.patch(`/tasks/${t.id}`, { dayOrder: i }))).catch(() => {});
  }
  // 마감 임박(3일 이내 미완료)
  const now = new Date();
  const soon = tasks
    .filter((t) => t.dueDate && stateOf(t) !== "done")
    .map((t) => ({ t, days: Math.ceil((new Date(t.dueDate!).getTime() - now.getTime()) / 86400000) }))
    .filter((x) => x.days <= 3)
    .sort((a, b) => a.days - b.days);

  // ───── 스케줄(오늘): 계획 + 실제 + 근태 ─────
  const _td = new Date();
  const dateKeyISO = `${_td.getFullYear()}-${String(_td.getMonth() + 1).padStart(2, "0")}-${String(_td.getDate()).padStart(2, "0")}`;
  const work = { start: targetUser?.workStart, end: targetUser?.workEnd };
  const todayLeave = userLeaves.find((l) => {
    if (l.status !== "approved") return false;
    const s = new Date(l.startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(l.endDate); e.setHours(23, 59, 59, 999);
    return now >= s && now <= e;
  });
  // 내가 부여한 업무: 나에게 / 남에게  +  남이 나에게 부여한 업무
  const assignedSelf = assigned.filter((t) => t.assignee?.id === targetId);
  const assignedOut = assigned.filter((t) => t.assignee?.id !== targetId);
  const fromOthers = tasks.filter((t) => t.assigner && t.assigner.id !== targetId);
  // 업무 리스트(백로그) = 아직 오늘의 업무에 없고 미완료인 것
  const myBacklog = assignedSelf.filter((t) => stateOf(t) !== "done" && !todayIds.has(t.id));
  const recvBacklog = fromOthers.filter(
    (t) => stateOf(t) !== "done" && (!t.acceptedAt || !todayIds.has(t.id)),
  );
  // 업무 리스트에서 오늘의 업무로 드래그&드롭
  async function dropToToday() {
    const id = listDragId;
    setListDragId(null);
    if (!id) return;
    await planToday(id, true);
  }
  const stLabel = (t: Task) =>
    stateOf(t) === "done" ? "완료" : stateOf(t) === "doing" ? "진행중" : "대기";

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
              ? `${me?.name ?? ""} · 현재 업무 · 오늘의 업무 · 업무 리스트`
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

        {/* 상단 2단: 좌(메인) / 우(오늘 스케줄·메모 고정) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)", gap: 18, alignItems: "start" }}>
          {/* ───────── 좌: 메인 ───────── */}
          <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
            {/* ▶ 현재 업무중 + ⏳ 마감 임박 (하나의 카드) */}
            <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
              <div className="panel-head">
                <div className="sec-title"><span className="em">▶</span> 현재 업무중</div>
                <span className="count" style={{ marginLeft: "auto" }}>{currentTasks.length}</span>
              </div>
              <div style={{ padding: "6px 14px 12px", display: "grid", gap: 8 }}>
                {currentTasks.length === 0 && (
                  <div style={{ color: "var(--text-3)", fontSize: 13 }}>
                    {isSelf
                      ? "지금 진행 중인 업무가 없어요. 아래 “오늘의 업무”에서 체크하면 여기로 올라옵니다."
                      : "지금 진행 중인 업무가 없어요."}
                  </div>
                )}
                {currentTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, fontSize: 14, flexWrap: "wrap",
                      padding: "10px 12px", border: "1px solid var(--primary)", borderRadius: 10, background: "var(--primary-soft, #eef0fe)",
                    }}
                  >
                    <span className="pill" style={{ background: PRI[t.priority].bg, color: PRI[t.priority].fg, fontSize: 10 }}>{PRI[t.priority].label}</span>
                    <span style={{ flex: 1, minWidth: 120, fontWeight: 700, cursor: "pointer" }} onClick={() => setDetailId(t.id)}>
                      {t.project && <span style={{ color: "var(--text-3)", fontSize: 11.5, fontWeight: 400 }}>({t.project.name}) </span>}
                      {t.title}
                    </span>
                    <b style={{ fontSize: 13, color: progressColor(t.progress) }}>{t.progress}%</b>
                    {isSelf && (
                      <>
                        <button className="btn sm" onClick={() => pause(t.id)} disabled={busy === t.id}>⏸ 일시정지</button>
                        <button className="btn primary sm" onClick={() => openEnd(t)} disabled={busy === t.id}>✓ 완료</button>
                      </>
                    )}
                    {t.statusMemo && (
                      <div style={{ flexBasis: "100%", fontSize: 12, color: "var(--text-2)" }}>📝 {t.statusMemo}</div>
                    )}
                  </div>
                ))}
              </div>
              {soon.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: "#a16207" }}>⏳ 마감 임박</div>
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
            </div>

            {/* ✅ 오늘의 업무 — 체크=시작, 리스트에서 드래그 담기, 순서 변경 */}
            <div
              className="card"
              style={{ outline: listDragId ? "2px dashed var(--primary)" : undefined, outlineOffset: -2 }}
              onDragOver={(e) => { if (isSelf && listDragId) e.preventDefault(); }}
              onDrop={() => { if (isSelf) void dropToToday(); }}
            >
              <div className="panel-head">
                <div className="sec-title"><span className="em">✅</span> 오늘의 업무</div>
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
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</div>
                )}
                {!loading && todayList.length === 0 && (
                  <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>
                    {dayLabel} 담긴 업무가 없어요. 아래 <b>업무 리스트</b>에서 항목을 드래그해 여기로 담으세요.
                  </div>
                )}
                {todayList.map((it, idx) => {
                  const output =
                    [it.reportRequired ? "📊" : "", it.videoRequired ? "🎥" : ""]
                      .filter(Boolean)
                      .join("") || "—";
                  return (
                    <div
                      key={it.id}
                      className={`chk-item ${stateOf(it)}`}
                      draggable={isSelf && dayOffset === 0}
                      onDragStart={(e) => { if (isSelf && dayOffset === 0) { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; } }}
                      onDragEnd={() => setDragIdx(null)}
                      onClick={() => setDetailId(it.id)}
                      style={{
                        cursor: isSelf && dayOffset === 0 ? "grab" : "pointer",
                        flexWrap: "wrap",
                        opacity: dragIdx === idx ? 0.4 : 1,
                        background: progressBg(it.progress),
                        borderLeft: `4px solid ${progressColor(it.progress)}`,
                      }}
                      title="드래그하면 순서 변경 · 클릭하면 상세"
                      onDragOver={(e) => isSelf && dragIdx !== null && e.preventDefault()}
                      onDrop={(e) => { if (isSelf && dragIdx !== null) { e.stopPropagation(); void reorderToday(idx); } }}
                    >
                      {isSelf && dayOffset === 0 && (
                        <span
                          onClick={(e) => e.stopPropagation()}
                          title="드래그해서 순서 변경"
                          style={{ color: "var(--text-3)", fontSize: 15, lineHeight: 1, userSelect: "none" }}
                        >
                          ⠿
                        </span>
                      )}
                      <input
                        type="checkbox"
                        checked={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelf && busy !== it.id) {
                            if (it.status === "paused") void resume(it.id);
                            else void start(it.id);
                          }
                        }}
                        onChange={() => {}}
                        disabled={!isSelf || busy === it.id}
                        title={it.status === "paused" ? "체크하면 재개 → 현재 업무중" : "체크하면 시작 → 현재 업무중"}
                        style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: isSelf ? "pointer" : "default" }}
                      />
                      <span
                        className="pill"
                        style={{ background: PRI[it.priority].bg, color: PRI[it.priority].fg, fontSize: 11 }}
                      >
                        {PRI[it.priority].label}
                      </span>
                      <span className="ct">
                        {it.project && (
                          <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>({it.project.name}) </span>
                        )}
                        {it.title}
                      </span>
                      <span className="meta">{output}</span>
                      <b style={{ fontSize: 12, color: progressColor(it.progress) }}>{it.progress}%</b>
                      {it.dueDate && (
                        <span
                          className="pill"
                          style={{
                            fontSize: 10,
                            background: ddays(it) <= 0 ? "#fee2e2" : ddays(it) <= 2 ? "#fef3c7" : "#eef0f2",
                            color: ddays(it) <= 0 ? "#b91c1c" : ddays(it) <= 2 ? "#a16207" : "#5c606b",
                          }}
                          title="마감일"
                        >
                          📅 {mdd(it.dueDate)} ({ddays(it) < 0 ? `D+${-ddays(it)}` : ddays(it) === 0 ? "D-Day" : `D-${ddays(it)}`})
                        </span>
                      )}
                      <button
                        className="btn sm"
                        onClick={(e) => { e.stopPropagation(); setDocTask({ id: it.id, title: it.title }); }}
                        title="업무설명 doc 새 창에서 보기/편집"
                      >
                        ⛶ 업무설명
                      </button>
                      {it.status === "paused" && (
                        <>
                          <span className="pill" style={{ background: "#fef3c7", color: "#a16207", fontSize: 10 }}>중단됨</span>
                          {isSelf && (
                            <button className="btn sm" onClick={(e) => { e.stopPropagation(); openEnd(it); }} disabled={busy === it.id}>
                              ✓ 완료
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="hint" style={{ padding: "0 18px 16px" }}>
                업무 리스트에서 <b>드래그</b>해 담기 · 손잡이(⠿)로 순서 변경 · <b>체크</b>하면 “현재 업무중”으로 올라갑니다
              </div>
            </div>

            {/* 나의 업무 + 요청받은 업무 (드래그해서 오늘의 업무로) */}
            <div className="card">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  padding: "14px",
                }}
              >
                {/* 🙋 나의 업무 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div className="sec-title" style={{ fontSize: 14 }}><span className="em">🙋</span> 나의 업무</div>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      {isSelf && <button className="btn sm" onClick={() => setMyAddOpen((o) => !o)}>＋ 추가</button>}
                      <span className="count">{myBacklog.length}</span>
                    </span>
                  </div>
                  {isSelf && myAddOpen && (
                    <div style={{ display: "flex", gap: 6, paddingBottom: 10, alignItems: "center" }}>
                      <input
                        className="inp"
                        placeholder="내 업무 제목"
                        value={myTitle}
                        onChange={(e) => setMyTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void addMyTask(); }}
                        style={{ flex: 1, minWidth: 0 }}
                        autoFocus
                      />
                      <select className="inp" value={myPrio} onChange={(e) => setMyPrio(e.target.value as Priority)} style={{ width: 80 }}>
                        {(["urgent", "high", "medium", "low"] as Priority[]).map((p) => (
                          <option key={p} value={p}>{PRI[p].label}</option>
                        ))}
                      </select>
                      <button className="btn primary sm" onClick={addMyTask} disabled={busy === "myadd"}>추가</button>
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 6 }}>
                    {myBacklog.length === 0 && (
                      <div style={{ color: "var(--text-3)", fontSize: 13 }}>담을 업무가 없어요. ＋추가로 만들어보세요.</div>
                    )}
                    {myBacklog.map((t) => (
                      <div
                        key={t.id}
                        draggable={isSelf}
                        onDragStart={(e) => { if (isSelf) { setListDragId(t.id); e.dataTransfer.effectAllowed = "move"; } }}
                        onDragEnd={() => setListDragId(null)}
                        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8, cursor: isSelf ? "grab" : "default", background: listDragId === t.id ? "var(--primary-soft,#eef0fe)" : undefined }}
                        title={isSelf ? "드래그해서 오늘의 업무로" : ""}
                      >
                        {isSelf && <span style={{ color: "var(--text-3)", fontSize: 14, userSelect: "none" }}>⠿</span>}
                        <span className="pill" style={{ background: PRI[t.priority].bg, color: PRI[t.priority].fg, fontSize: 10 }}>{PRI[t.priority].label}</span>
                        <span style={{ flex: 1, cursor: "pointer" }} onClick={() => setDetailId(t.id)}>{t.title}</span>
                        <span className="pill gray" style={{ fontSize: 10 }}>{stLabel(t)}</span>
                        <b style={{ fontSize: 12, color: progressColor(t.progress) }}>{t.progress}%</b>
                        {isSelf && (
                          <button className="btn sm" onClick={() => planToday(t.id, true)} disabled={busy === t.id}>↓ 오늘</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 📥 요청받은 업무 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div className="sec-title" style={{ fontSize: 14 }}><span className="em">📥</span> 요청받은 업무</div>
                    <span className="count" style={{ marginLeft: "auto" }}>{recvBacklog.length}</span>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {recvBacklog.length === 0 && (
                      <div style={{ color: "var(--text-3)", fontSize: 13 }}>없음</div>
                    )}
                    {recvBacklog.map((t) => {
                      const accepted = !!t.acceptedAt;
                      return (
                        <div
                          key={t.id}
                          draggable={isSelf && accepted}
                          onDragStart={(e) => { if (isSelf && accepted) { setListDragId(t.id); e.dataTransfer.effectAllowed = "move"; } }}
                          onDragEnd={() => setListDragId(null)}
                          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "7px 8px", border: `1px solid ${t.reworkCount ? "#fb923c" : "var(--border)"}`, borderRadius: 8, flexWrap: "wrap", background: t.reworkCount ? "#fff7ed" : (listDragId === t.id ? "var(--primary-soft,#eef0fe)" : undefined), cursor: isSelf && accepted ? "grab" : "default" }}
                          title={isSelf && accepted ? "드래그해서 오늘의 업무로" : ""}
                        >
                          {isSelf && accepted && <span style={{ color: "var(--text-3)", fontSize: 14, userSelect: "none" }}>⠿</span>}
                          <span className="pill" style={{ background: PRI[t.priority].bg, color: PRI[t.priority].fg, fontSize: 10 }}>{PRI[t.priority].label}</span>
                          {t.reworkCount ? (
                            <span className="pill" style={{ background: "#c2410c", color: "#fff", fontSize: 10, fontWeight: 700 }}>재작업 #{t.reworkCount}</span>
                          ) : null}
                          <span style={{ flex: 1, minWidth: 80, cursor: "pointer" }} onClick={() => setDetailId(t.id)}>
                            {t.project && <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>({t.project.name}) </span>}
                            {t.title}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }} title="요청자 · 요청일">
                            {t.assigner?.name} · {mdd(t.createdAt)}
                          </span>
                          {!accepted ? (
                            isSelf ? (
                              <button className="btn primary sm" onClick={() => accept(t.id)} disabled={busy === t.id}>수락</button>
                            ) : (
                              <span className="pill" style={{ background: "#fef9c3", color: "#a16207", fontSize: 10 }}>수락대기</span>
                            )
                          ) : (
                            <>
                              <span className="pill gray" style={{ fontSize: 10 }}>{stLabel(t)}</span>
                              {isSelf && (
                                <button className="btn sm" onClick={() => planToday(t.id, true)} disabled={busy === t.id}>↓ 오늘</button>
                              )}
                            </>
                          )}
                          {t.reworkCount && t.reworkReason ? (
                            <div style={{ flexBasis: "100%", fontSize: 11.5, color: "#c2410c", paddingLeft: 2 }}>
                              🔁 재작업 사유: {t.reworkReason}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 📤 요청한 업무 · 📨 멘션 소통피드 — 나란히 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
              {/* 📤 요청한 업무 */}
              <div className="card">
                <div className="panel-head">
                  <div className="sec-title"><span className="em">📤</span> 요청한 업무</div>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {isSelf && <a href="/requests" className="btn sm">📊 전체·분석</a>}
                    <span className="count">{assignedOut.length}</span>
                  </span>
                </div>
                <div style={{ padding: "6px 14px 14px", display: "grid", gap: 6 }}>
                  {assignedOut.length === 0 && (
                    <div style={{ color: "var(--text-3)", fontSize: 13 }}>대시보드 → 업무 부여로 추가</div>
                  )}
                  {assignedOut.map((t) => (
                    <div key={t.id} onClick={() => setDetailId(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "7px 8px", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" }}>
                      <span className="pill" style={{ background: PRI[t.priority].bg, color: PRI[t.priority].fg, fontSize: 10 }}>{PRI[t.priority].label}</span>
                      <span style={{ flex: 1, minWidth: 80 }}>
                        {t.project && <span style={{ color: "var(--text-3)", fontSize: 11.5 }}>({t.project.name}) </span>}
                        {t.title}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-2)" }}>
                        <span className="avatar" style={{ background: t.assignee?.avatarColor ?? "#999", width: 20, height: 20, fontSize: 10 }}>{t.assignee?.name?.slice(0, 1) ?? "?"}</span>
                        {t.assignee?.name ?? "미지정"}
                      </span>
                      {t.acceptedAt ? (
                        <span className="pill" style={{ background: "#dcfce7", color: "#15803d", fontSize: 10 }}>수락 {mdd(t.acceptedAt)}</span>
                      ) : (
                        <span className="pill" style={{ background: "#fef9c3", color: "#a16207", fontSize: 10 }}>수락대기</span>
                      )}
                      <span className="pill gray" style={{ fontSize: 10 }}>{stLabel(t)}</span>
                      <b style={{ fontSize: 12, color: progressColor(t.progress) }}>{t.progress}%</b>
                      {t.grade ? (
                        <span className="pill" style={{ background: "#ede9fe", color: "#6d28d9", fontSize: 10, fontWeight: 700 }}>🏅 {t.grade}</span>
                      ) : stateOf(t) === "done" && isSelf ? (
                        <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); setReviewTask(t); }}>🔍 검수</button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* 📨 멘션 & 소통 피드 (본인만) */}
              {isSelf && (
                <div className="card">
                  <div className="panel-head">
                    <div className="sec-title"><span className="em">📨</span> 멘션 &amp; 소통 피드</div>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="count">새 알림 {notifs.filter((n) => !n.read).length}</span>
                      {notifs.some((n) => !n.read) && (
                        <button className="btn sm" onClick={markAllRead}>모두 읽음</button>
                      )}
                    </span>
                  </div>
                  {!loading && notifs.length === 0 && (
                    <div style={{ padding: 18, color: "var(--text-3)", fontSize: 13 }}>아직 알림이 없어요.</div>
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
          </div>

          {/* ───────── 우: 오늘 스케줄 · 포스트잇 메모 · 통계 (상단 고정) ───────── */}
          <div style={{ position: "sticky", top: 14, display: "grid", gap: 16 }}>
            {todayLeave && (
              <div style={{ padding: "8px 12px", background: "#dcfce7", borderRadius: 8, fontSize: 13, color: "#15803d" }}>
                🌴 오늘은 휴가 ({LEAVE_KO[todayLeave.type]})
              </div>
            )}
            <ScheduleBoard
              userId={targetId ?? ""}
              dateKey={dateKeyISO}
              workStart={work.start}
              workEnd={work.end}
              tasks={tasks}
              dragTasks={dayTasks}
              readOnly={!isSelf}
            />

            {/* 📌 포스트잇 자유 메모 (개인) */}
            {isSelf && (
              <div
                style={{
                  background: "#fff9c4",
                  border: "1px solid #f5e58c",
                  borderRadius: 10,
                  padding: 14,
                  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#8a6d0b" }}>📌 메모</div>
                <textarea
                  value={scratch}
                  onChange={(e) => updateScratch(e.target.value)}
                  placeholder="자유롭게 끄적여보세요… (자동 저장)"
                  style={{
                    width: "100%",
                    minHeight: 160,
                    resize: "vertical",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    fontFamily: "inherit",
                    color: "#5c4b06",
                  }}
                />
              </div>
            )}

            <div className="card">
              <div className="panel-head">
                <div className="sec-title"><span className="em">📊</span> 업무 통계</div>
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
          onDeleted={() => {
            setDetailId(null);
            void load();
          }}
        />
      )}

      {reviewTask && (
        <ReviewModal
          task={reviewTask}
          onClose={() => setReviewTask(null)}
          onDone={() => {
            setReviewTask(null);
            void load();
          }}
        />
      )}

      {docTask && (
        <TaskDocModal
          taskId={docTask.id}
          title={docTask.title}
          readOnly={!isSelf}
          onClose={() => setDocTask(null)}
          onSaved={() => void load()}
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
