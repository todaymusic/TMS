"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ProjectListItem, type Task } from "@/lib/api";

const DOWS = ["월", "화", "수", "목", "금", "토", "일"];

type EvKind = "done" | "prog" | "late";
const EV_STYLE: Record<EvKind, React.CSSProperties> = {
  done: { background: "#dcfce7", color: "#15803d" },
  prog: { background: "#dbeafe", color: "#1d4ed8" },
  late: { background: "#fee2e2", color: "#b91c1c" },
};

const GANTT_COLORS = ["#4f46e5", "#0f766e", "#db2777", "#ea580c", "#0891b2"];

function evKind(t: Task, today: Date): EvKind {
  if (t.status === "done" || t.status === "completed_pending") return "done";
  if (t.dueDate && new Date(t.dueDate) < today) return "late";
  return "prog";
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // 표시 월 (기준: 2026-06)
  const [ym, setYm] = useState<{ y: number; m: number }>({ y: 2026, m: 5 }); // m: 0-based

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([
          api.get<Task[]>("/tasks"),
          api.get<ProjectListItem[]>("/projects"),
        ]);
        setTasks(t);
        setProjects(p);
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

    // 일자별 이벤트
    const byDay = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        byDay.set(day, [...(byDay.get(day) ?? []), t]);
      }
    }

    const cells: { day: number | null; tasks: Task[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: null, tasks: [] });
    for (let d = 1; d <= days; d++) cells.push({ day: d, tasks: byDay.get(d) ?? [] });
    while (cells.length % 7 !== 0) cells.push({ day: null, tasks: [] });

    return { cells, monthLabel: `${y}년 ${m + 1}월` };
  }, [ym, tasks]);

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
        <div className="cal-head">
          <div className="cal-nav">
            <button onClick={() => move(-1)}>◀</button>
            <button onClick={() => move(1)}>▶</button>
          </div>
          <div className="cal-month">{monthLabel}</div>
          <div style={{ marginLeft: "auto" }} className="search">
            🔍
            <input
              placeholder="이전 태스크 검색 (담당자·상태·기간)"
              style={{ width: 240 }}
            />
          </div>
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
                {c.tasks.map((t) => {
                  const k = evKind(t, today);
                  return (
                    <div key={t.id} className="cal-ev" style={EV_STYLE[k]}>
                      {(t.assignee?.name?.slice(0, 1) ?? "") + ":" + t.title}
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>

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
      </div>
    </>
  );
}
