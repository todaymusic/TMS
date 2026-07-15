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
import { useBackdropClose } from "@/lib/useBackdropClose";
import { MeetingCreateModal, MeetingDetailModal } from "./MeetingModals";

const DOWS = ["월", "화", "수", "목", "금", "토", "일"];


type LeaveCal = Leave & { user: { id: string; name: string; avatarColor: string } };
const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half: "반차",
  quarter: "반반차",
  sick: "병가",
  etc: "기타",
  business_trip: "출장",
};

function daypartLabel(dp?: "am" | "pm" | null): string {
  return dp === "am" ? " (오전)" : dp === "pm" ? " (오후)" : "";
}
// 상태별 색 (승인=초록 / 신청=노랑 / 반려=회색)
function leaveStyle(s: Leave["status"]): React.CSSProperties {
  if (s === "approved") return { background: "#dcfce7", color: "#15803d" };
  if (s === "rejected") return { background: "#f3f4f6", color: "#6b7280" };
  return { background: "#fef9c3", color: "#a16207" };
}

const GANTT_COLORS = ["#4f46e5", "#0f766e", "#db2777", "#ea580c", "#0891b2"];

const TRIP_LBL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-2)",
  marginBottom: 6,
};

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

  // 출장 추가 (근무 탭에서 바로 등록)
  const [tripOpen, setTripOpen] = useState(false);
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [tripDaypart, setTripDaypart] = useState<"" | "am" | "pm">("");
  const [tripReason, setTripReason] = useState("");
  const [tripBusy, setTripBusy] = useState(false);
  const [tripMsg, setTripMsg] = useState<string | null>(null);
  const [editTripId, setEditTripId] = useState<string | null>(null); // null=추가, id=수정
  const tripBackdrop = useBackdropClose({
    isDirty: () => tripStart !== "" || tripEnd !== "" || tripReason.trim() !== "",
    close: () => closeTrip(),
    busy: tripBusy,
    resetKey: tripOpen,
  });

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
  async function loadLeaves() {
    try {
      setLeaves(await api.get<LeaveCal[]>("/leaves"));
    } catch {
      /* noop */
    }
  }
  function closeTrip() {
    setTripOpen(false);
    setEditTripId(null);
    setTripStart("");
    setTripEnd("");
    setTripDaypart("");
    setTripReason("");
    setTripMsg(null);
  }
  function openAddTrip() {
    closeTrip();
    setTripOpen(true);
  }
  function openEditTrip(lv: LeaveCal) {
    setEditTripId(lv.id);
    setTripStart(lv.startDate.slice(0, 10));
    setTripEnd(lv.endDate.slice(0, 10));
    setTripDaypart((lv.daypart as "am" | "pm" | null) ?? "");
    setTripReason(lv.reason ?? "");
    setTripMsg(null);
    setTripOpen(true);
  }
  async function saveTrip() {
    setTripMsg(null);
    if (!me) return;
    if (!tripStart || !tripEnd) {
      setTripMsg("시작일과 종료일을 입력하세요");
      return;
    }
    setTripBusy(true);
    try {
      if (editTripId) {
        await api.patch(`/leaves/${editTripId}`, {
          startDate: tripStart,
          endDate: tripEnd,
          reason: tripReason.trim() || undefined,
          daypart: tripDaypart || null,
        });
      } else {
        await api.post("/leaves", {
          userId: me.id,
          type: "business_trip",
          startDate: tripStart,
          endDate: tripEnd,
          reason: tripReason.trim() || undefined,
          daypart: tripDaypart || undefined,
        });
      }
      closeTrip();
      await loadLeaves();
    } catch (e) {
      setTripMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setTripBusy(false);
    }
  }
  async function deleteTrip() {
    if (!editTripId) return;
    if (!window.confirm("이 출장을 삭제할까요?")) return;
    setTripBusy(true);
    try {
      await api.del(`/leaves/${editTripId}`);
      closeTrip();
      await loadLeaves();
    } catch (e) {
      setTripMsg(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setTripBusy(false);
    }
  }
  // 표시 월 — 현재 월을 기본으로 (m: 0-based)
  const [ym, setYm] = useState<{ y: number; m: number }>(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

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

    // 업무: 완료된 업무를 '완료일(endedAt)'에 표시 (미완료·마감임박은 표시 안 함, 검색어로 필터)
    const term = q.trim().toLowerCase();
    const taskByDay = new Map<number, Task[]>();
    for (const t of tasks) {
      const isDone = t.status === "done" || t.status === "completed_pending";
      if (!isDone || !t.endedAt) continue;
      if (
        term &&
        !t.title.toLowerCase().includes(term) &&
        !(t.assignee?.name.toLowerCase().includes(term) ?? false)
      )
        continue;
      const d = new Date(t.endedAt);
      if (d.getFullYear() === y && d.getMonth() === m) {
        const day = d.getDate();
        taskByDay.set(day, [...(taskByDay.get(day) ?? []), t]);
      }
    }

    // 근무(연차): 시작~종료 기간 전체 날짜에 표시
    // 반려(미승인)·취소요청된 연차는 캘린더에 표시하지 않음 (기존 데이터 포함)
    const leaveByDay = new Map<number, LeaveCal[]>();
    for (const lv of leaves) {
      if (lv.status === "rejected" || lv.cancelRequested) continue;
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
    // 아카이브된 프로젝트는 타임라인에서 제외
    const withDates = projects.filter((p) => p.startDate && p.endDate && p.status !== "archived");
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
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>연차·휴가·출장 표시</span>
              <button className="btn primary sm" onClick={openAddTrip}>
                ✈️ 출장 추가
              </button>
            </span>
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
                    const color = t.assignee?.avatarColor ?? "#9ca3af";
                    // 마감일보다 늦게 완료 → 빨간 테두리
                    const late =
                      !!t.dueDate && !!t.endedAt &&
                      new Date(t.endedAt).setHours(0, 0, 0, 0) > new Date(t.dueDate).setHours(0, 0, 0, 0);
                    return (
                      <div
                        key={t.id}
                        className="cal-ev"
                        style={{
                          background: color,
                          color: "#fff",
                          ...(late ? { boxShadow: "inset 0 0 0 2px #b91c1c" } : {}),
                        }}
                        title={`${t.assignee?.name ?? "미배정"} · ${t.title} · 완료${late ? " (마감 초과)" : ""}`}
                      >
                        {t.title}
                      </div>
                    );
                  })}
                {tab === "work" &&
                  c.leaves.map((lv) => {
                    const isTrip = lv.type === "business_trip";
                    const canEdit = isTrip && lv.user.id === me?.id;
                    return (
                      <div
                        key={lv.id}
                        className="cal-ev"
                        onClick={canEdit ? () => openEditTrip(lv) : undefined}
                        title={canEdit ? "클릭하면 수정/삭제" : undefined}
                        style={{
                          ...(isTrip ? { background: "#dbeafe", color: "#1d4ed8" } : leaveStyle(lv.status)),
                          ...(canEdit ? { cursor: "pointer" } : {}),
                        }}
                      >
                        {isTrip ? "✈️ " : ""}
                        {lv.user.name} {LEAVE_LABEL[lv.type]}
                        {daypartLabel(lv.daypart)}
                      </div>
                    );
                  })}
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
      {tripOpen && (
        <div
          {...tripBackdrop}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 420, padding: 22 }}>
            <div className="sec-title" style={{ marginBottom: 14 }}>
              <span className="em">✈️</span> {editTripId ? "출장 수정" : "출장 추가"}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={TRIP_LBL}>구분</label>
                <select className="inp" value={tripDaypart} onChange={(e) => setTripDaypart(e.target.value as "" | "am" | "pm")}>
                  <option value="">종일</option>
                  <option value="am">오전 반일</option>
                  <option value="pm">오후 반일</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={TRIP_LBL}>시작일</label>
                  <input className="inp" type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
                </div>
                <div>
                  <label style={TRIP_LBL}>종료일</label>
                  <input className="inp" type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={TRIP_LBL}>사유 (선택)</label>
                <input className="inp" value={tripReason} onChange={(e) => setTripReason(e.target.value)} placeholder="예: 양재 클라이언트 미팅" />
              </div>
            </div>
            {tripMsg && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{tripMsg}</div>}
            {!editTripId && (
              <div style={{ fontSize: 11.5, color: "#2563eb", marginTop: 8 }}>
                출장은 승인 없이 바로 등록되고, 연차 차감이 없어요.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {editTripId && (
                <button className="btn" style={{ color: "#dc2626" }} onClick={deleteTrip} disabled={tripBusy}>
                  삭제
                </button>
              )}
              <button className="btn" style={{ flex: 1 }} onClick={closeTrip} disabled={tripBusy}>취소</button>
              <button className="btn primary" style={{ flex: 1 }} onClick={saveTrip} disabled={tripBusy}>
                {tripBusy ? "저장 중…" : editTripId ? "수정 저장" : "출장 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
