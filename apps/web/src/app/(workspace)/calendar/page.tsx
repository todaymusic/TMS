"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type Leave,
  type LeaveType,
  type Meeting,
  type ProjectListItem,
  type Task,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MeetingCreateModal, MeetingDetailModal } from "./MeetingModals";

const DOWS = ["월", "화", "수", "목", "금", "토", "일"];

type EvKind = "done" | "prog" | "late";
const EV_STYLE: Record<EvKind, React.CSSProperties> = {
  done: { background: "#dcfce7", color: "#15803d" },
  prog: { background: "#dbeafe", color: "#1d4ed8" },
  late: { background: "#fee2e2", color: "#b91c1c" },
};

type LeaveCal = Leave & { user: { id: string; name: string; avatarColor: string } };
const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half: "반차",
  quarter: "반반차",
  sick: "병가",
  etc: "기타",
};
// 상태별 색 (승인=초록 / 신청=노랑 / 반려=회색)
function leaveStyle(s: Leave["status"]): React.CSSProperties {
  if (s === "approved") return { background: "#dcfce7", color: "#15803d" };
  if (s === "rejected") return { background: "#f3f4f6", color: "#6b7280" };
  return { background: "#fef9c3", color: "#a16207" };
}

const GANTT_COLORS = ["#4f46e5", "#0f766e", "#db2777", "#ea580c", "#0891b2"];

function evKind(t: Task, today: Date): EvKind {
  if (t.status === "done" || t.status === "completed_pending") return "done";
  if (t.dueDate && new Date(t.dueDate) < today) return "late";
  return "prog";
}

export default function CalendarPage() {
  const { user: me } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [leaves, setLeaves] = useState<LeaveCal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"task" | "work" | "meeting">("task");
  const [q, setQ] = useState("");
  const [meetCreate, setMeetCreate] = useState(false);
  const [meetSel, setMeetSel] = useState<Meeting | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function loadMeetings() {
    try {
      setMeetings(await api.get<Meeting[]>("/meetings"));
    } catch {
      /* noop */
    }
  }
  async function syncDrive() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.post<{ imported: number; videoOnly?: number; skipped: number }>(
        `/meetings/sync?authorId=${me?.id ?? ""}`,
        {},
      );
      const vo = r.videoOnly ? ` + 영상 ${r.videoOnly}건` : "";
      setSyncMsg(`✅ ${r.imported}건${vo} 가져옴 (중복 ${r.skipped} 건너뜀)`);
      await loadMeetings();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message.replace(/^API.*?→\s*\d+\s*/, "") : "동기화 실패");
    } finally {
      setSyncing(false);
    }
  }
  // 표시 월 (기준: 2026-06)
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: 2026, m: 5 }); // m: 0-based

  useEffect(() => {
    (async () => {
      try {
        const [t, p, l, mt] = await Promise.all([
          api.get<Task[]>("/tasks"),
          api.get<ProjectListItem[]>("/projects"),
          api.get<LeaveCal[]>("/leaves"),
          api.get<Meeting[]>("/meetings"),
        ]);
        setTasks(t);
        setProjects(p);
        setLeaves(l);
        setMeetings(mt);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "불러오기 실패");
      }
    })();
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { cells, monthLabel } = useMemo(() => {
    const { y, m } = ym;
    const firstDay = new Date(y, m, 1).getDay(); // 0=일
    const offset = (firstDay + 6) % 7; // 월요일 시작
    const days = new Date(y, m + 1, 0).getDate();

    // 업무: 마감일에 표시 (검색어로 필터)
    const term = q.trim().toLowerCase();
    const taskByDay = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (
        term &&
        !t.title.toLowerCase().includes(term) &&
        !(t.assignee?.name.toLowerCase().includes(term) ?? false)
      )
        continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        taskByDay.set(day, [...(taskByDay.get(day) ?? []), t]);
      }
    }

    // 근무(연차): 시작~종료 기간 전체 날짜에 표시
    const leaveByDay = new Map<number, LeaveCal[]>();
    for (const lv of leaves) {
      const s = new Date(lv.startDate);
      const e = new Date(lv.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === y && d.getMonth() === m) {
          const day = d.getDate();
          leaveByDay.set(day, [...(leaveByDay.get(day) ?? []), lv]);
        }
      }
    }

    // 회의: 날짜에 표시
    const meetByDay = new Map<number, Meeting[]>();
    for (const mt of meetings) {
      const d = new Date(mt.date);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        meetByDay.set(day, [...(meetByDay.get(day) ?? []), mt]);
      }
    }

    type Cell = { day: number | null; tasks: Task[]; leaves: LeaveCal[]; meetings: Meeting[] };
    const empty = (): Cell => ({ day: null, tasks: [], leaves: [], meetings: [] });
    const cells: Cell[] = [];
    for (let i = 0; i < offset; i++) cells.push(empty());
    for (let d = 1; d <= days; d++)
      cells.push({ day: d, tasks: taskByDay.get(d) ?? [], leaves: leaveByDay.get(d) ?? [], meetings: meetByDay.get(d) ?? [] });
    while (cells.length % 7 !== 0) cells.push(empty());

    return { cells, monthLabel: `${y}년 ${m + 1}월` };
  }, [ym, tasks, leaves, meetings, q]);

  // 간트: 전체 프로젝트 기간 범위에 맞춰 막대 배치
  const gantt = useMemo(() => {
    const withDates = projects.filter((p) => p.startDate && p.endDate);
    if (withDates.length === 0) return { rows: [], range: null as null | [number, number] };
    const starts = withDates.map((p) => new Date(p.startDate!).getTime());
    const ends = withDates.map((p) => new Date(p.endDate!).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const span = Math.max(max - min, 1);
    const rows = withDates.map((p, i) => {
      const s = new Date(p.startDate!).getTime();
      const e = new Date(p.endDate!).getTime();
      const left = ((s - min) / span) * 100;
      const width = Math.max(((e - s) / span) * 100, 4);
      const fmt = (d: string) =>
        `${new Date(d).getMonth() + 1}/${new Date(d).getDate()}`;
      return {
        id: p.id,
        name: p.name,
        left,
        width,
        label: `${fmt(p.startDate!)} – ${fmt(p.endDate!)}`,
        color:
          p.status === "archived"
            ? "#9ca3af"
            : GANTT_COLORS[i % GANTT_COLORS.length],
        archived: p.status === "archived",
      };
    });
    return { rows, range: [min, max] as [number, number] };
  }, [projects]);

  const isThisMonth =
    today.getFullYear() === ym.y && today.getMonth() === ym.m;

  const move = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>캘린더</h1>
          <div className="sub">월별 업무 진행 현황 &amp; 프로젝트 타임라인</div>
        </div>
      </div>

      <div className="content">
        {err && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {err}
          </div>
        )}
        {/* 탭: 업무 / 근무 / 회의 */}
        <div className="cat-row" style={{ marginBottom: 14, maxWidth: 340 }}>
          <div className={`cat${tab === "task" ? " on" : ""}`} onClick={() => setTab("task")}>
            📋 업무
          </div>
          <div className={`cat${tab === "work" ? " on" : ""}`} onClick={() => setTab("work")}>
            🌴 근무
          </div>
          <div className={`cat${tab === "meeting" ? " on" : ""}`} onClick={() => setTab("meeting")}>
            📹 회의
          </div>
        </div>

        <div className="cal-head">
          <div className="cal-nav">
            <button onClick={() => move(-1)}>◀</button>
            <button onClick={() => move(1)}>▶</button>
          </div>
          <div className="cal-month">{monthLabel}</div>
          {tab === "task" ? (
            <div style={{ marginLeft: "auto" }} className="search">
              🔍
              <input
                placeholder="업무·담당자 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: 200 }}
              />
            </div>
          ) : tab === "meeting" ? (
            <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {syncMsg && <span style={{ fontSize: 12, color: syncMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>{syncMsg}</span>}
              <button className="btn sm" onClick={syncDrive} disabled={syncing}>
                {syncing ? "동기화 중…" : "🔄 드라이브 동기화"}
              </button>
              <button className="btn primary sm" onClick={() => setMeetCreate(true)}>
                ＋ 회의 만들기
              </button>
            </span>
          ) : (
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
              연차·휴가 기간 표시
            </div>
          )}
        </div>

        <div className="cal-grid">
          {DOWS.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((c, idx) =>
            c.day === null ? (
              <div key={`m${idx}`} className="cal-cell muted" />
            ) : (
              <div
                key={c.day}
                className={`cal-cell${
                  isThisMonth && c.day === today.getDate() ? " today" : ""
                }`}
              >
                <div className="cal-num">{c.day}</div>
                {tab === "task" &&
                  c.tasks.map((t) => {
                    const k = evKind(t, today);
                    return (
                      <div
                        key={t.id}
                        className="cal-ev"
                        style={{ ...EV_STYLE[k], display: "flex", alignItems: "center", gap: 4 }}
                        title={t.assignee?.name ? `${t.assignee.name} · ${t.title}` : t.title}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: t.assignee?.avatarColor ?? "#9ca3af",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      </div>
                    );
                  })}
                {tab === "work" &&
                  c.leaves.map((lv) => (
                    <div key={lv.id} className="cal-ev" style={leaveStyle(lv.status)}>
                      {lv.user.name} {LEAVE_LABEL[lv.type]}
                    </div>
                  ))}
                {tab === "meeting" &&
                  c.meetings.map((mt) => (
                    <div
                      key={mt.id}
                      className="cal-ev"
                      style={{ background: "#ede9fe", color: "#6d28d9", cursor: "pointer" }}
                      onClick={() => setMeetSel(mt)}
                      title="클릭하면 회의 상세"
                    >
                      📹 {mt.title}
                    </div>
                  ))}
              </div>
            ),
          )}
        </div>

        {tab === "task" && (
        <div className="card gantt">
          <div className="sec-title mb16">
            <span className="em">📊</span> 프로젝트 타임라인
          </div>
          {gantt.rows.length === 0 && (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>
              기간이 설정된 프로젝트가 없어요.
            </div>
          )}
          {gantt.rows.map((r) => (
            <div key={r.id} className="gantt-row">
              <div
                className="nm"
                style={r.archived ? { color: "var(--text-3)" } : undefined}
              >
                {r.name}
              </div>
              <div className="gantt-track">
                <div
                  className="gantt-bar"
                  style={{
                    left: `${r.left}%`,
                    width: `${r.width}%`,
                    background: r.color,
                  }}
                >
                  {r.label}
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {meetCreate && (
        <MeetingCreateModal
          authorId={me?.id}
          defaultDate={`${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(Math.min(today.getDate(), new Date(ym.y, ym.m + 1, 0).getDate())).padStart(2, "0")}`}
          onClose={() => setMeetCreate(false)}
          onCreated={(m) => {
            setMeetCreate(false);
            setMeetings((cur) => [m, ...cur]);
            setTab("meeting");
          }}
        />
      )}
      {meetSel && (
        <MeetingDetailModal
          meeting={meetSel}
          onClose={() => setMeetSel(null)}
          onChanged={loadMeetings}
        />
      )}
    </>
  );
}
