"use client";

import { useMemo, useState } from "react";
import { progressColor, type TaskInProject } from "@/lib/api";

const DOWS = ["월", "화", "수", "목", "금", "토", "일"];

function evStyle(t: TaskInProject): React.CSSProperties {
  if (t.status === "done" || t.status === "completed_pending")
    return { background: "#dcfce7", color: "#15803d" };
  const late = t.dueDate && new Date(t.dueDate) < new Date();
  if (late) return { background: "#fee2e2", color: "#b91c1c" };
  return { background: "#dbeafe", color: "#1d4ed8" };
}

export default function ProjectCalendar({
  tasks,
  startDate,
  endDate,
  compact = false,
}: {
  tasks: TaskInProject[];
  startDate: string | null;
  endDate: string | null;
  compact?: boolean;
}) {
  // 기본 월: 프로젝트 시작월 → 없으면 첫 업무 마감월 → 없으면 현재
  const base = useMemo(() => {
    const src =
      startDate ??
      tasks.map((t) => t.dueDate).filter(Boolean).sort()[0] ??
      null;
    const d = src ? new Date(src) : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [startDate, tasks]);
  const [ym, setYm] = useState(base);

  const { cells, label } = useMemo(() => {
    const { y, m } = ym;
    const firstDay = new Date(y, m, 1).getDay();
    const offset = (firstDay + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const byDay = new Map<number, TaskInProject[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        byDay.set(day, [...(byDay.get(day) ?? []), t]);
      }
    }
    const cells: { day: number | null; tasks: TaskInProject[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: null, tasks: [] });
    for (let d = 1; d <= days; d++) cells.push({ day: d, tasks: byDay.get(d) ?? [] });
    while (cells.length % 7 !== 0) cells.push({ day: null, tasks: [] });
    return { cells, label: `${y}년 ${m + 1}월` };
  }, [ym, tasks]);

  const today = new Date();
  const isThisMonth = today.getFullYear() === ym.y && today.getMonth() === ym.m;
  const move = (d: number) =>
    setYm(({ y, m }) => {
      const nd = new Date(y, m + d, 1);
      return { y: nd.getFullYear(), m: nd.getMonth() };
    });

  const fmt = (s: string | null) =>
    s ? `${new Date(s).getMonth() + 1}/${new Date(s).getDate()}` : "";

  // ───── 소형(헤더용) ─────
  if (compact) {
    return (
      <div
        className="card"
        style={{ padding: 12, width: 250, fontSize: 11, alignSelf: "flex-start" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <button className="btn sm" style={{ padding: "0 6px" }} onClick={() => move(-1)}>
            ◀
          </button>
          <span style={{ fontWeight: 700, fontSize: 12 }}>{label}</span>
          <button className="btn sm" style={{ padding: "0 6px" }} onClick={() => move(1)}>
            ▶
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {DOWS.map((d) => (
            <div key={d} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 10 }}>
              {d}
            </div>
          ))}
          {cells.map((c, idx) =>
            c.day === null ? (
              <div key={`m${idx}`} />
            ) : (
              <div
                key={c.day}
                title={c.tasks.map((t) => t.title).join(", ")}
                style={{
                  textAlign: "center",
                  padding: "3px 0",
                  borderRadius: 5,
                  position: "relative",
                  fontWeight: c.tasks.length ? 700 : 400,
                  background:
                    isThisMonth && c.day === today.getDate() ? "#eef2ff" : undefined,
                }}
              >
                {c.day}
                {c.tasks.length > 0 && (
                  <span
                    style={{
                      display: "block",
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      margin: "1px auto 0",
                      background: progressColor(c.tasks[0].progress),
                    }}
                  />
                )}
              </div>
            ),
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-3)" }}>
          📅 {fmt(startDate)}–{fmt(endDate)}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 18 }}>
      <div className="cal-head" style={{ marginBottom: 12 }}>
        <div className="cal-nav">
          <button onClick={() => move(-1)}>◀</button>
          <button onClick={() => move(1)}>▶</button>
        </div>
        <div className="cal-month">{label}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
          📅 프로젝트 기간 {fmt(startDate)}–{fmt(endDate)}
        </div>
      </div>
      <div className="cal-grid">
        {DOWS.map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {cells.map((c, idx) =>
          c.day === null ? (
            <div key={`m${idx}`} className="cal-cell muted" />
          ) : (
            <div
              key={c.day}
              className={`cal-cell${isThisMonth && c.day === today.getDate() ? " today" : ""}`}
            >
              <div className="cal-num">{c.day}</div>
              {c.tasks.map((t) => (
                <div key={t.id} className="cal-ev" style={evStyle(t)}>
                  <span style={{ color: progressColor(t.progress) }}>●</span> {t.title}
                </div>
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
