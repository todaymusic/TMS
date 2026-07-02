"use client";

import { useEffect, useState } from "react";
import { api, progressColor, type ProjectListItem, type Task } from "@/lib/api";

function fmt(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}
function durH(t: Task): number | null {
  if (!t.startedAt || !t.endedAt) return null;
  return (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 3600000;
}

type Notes = { summary: string; issues: string; next: string };

export default function ProjectReportModal({
  project,
  onClose,
}: {
  project: ProjectListItem;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Notes>({ summary: "", issues: "", next: "" });

  useEffect(() => {
    api.get<Task[]>(`/tasks?projectId=${project.id}`).then(setTasks).catch(() => {});
    try {
      const raw = localStorage.getItem(`tms_report_${project.id}`);
      if (raw) setNotes({ summary: "", issues: "", next: "", ...JSON.parse(raw) });
    } catch {
      /* noop */
    }
  }, [project.id]);

  function update(k: keyof Notes, v: string) {
    const n = { ...notes, [k]: v };
    setNotes(n);
    try {
      localStorage.setItem(`tms_report_${project.id}`, JSON.stringify(n));
    } catch {
      /* noop */
    }
  }

  const done = tasks.filter((t) => t.status === "done" || t.status === "completed_pending");
  const durs = done.map(durH).filter((x): x is number => x != null);
  const avgH = durs.length ? Math.round((durs.reduce((a, b) => a + b, 0) / durs.length) * 10) / 10 : 0;
  const withDue = done.filter((t) => t.dueDate);
  const onTime = withDue.filter((t) => new Date(t.endedAt!) <= new Date(t.dueDate!)).length;
  const rework = tasks.reduce((a, t) => a + (t.reworkCount ?? 0), 0);
  const grades = { 우수: 0, 양호: 0, 보완: 0 } as Record<string, number>;
  tasks.forEach((t) => { if (t.grade && grades[t.grade] != null) grades[t.grade]++; });
  const members = [...project.owners, ...project.participants];

  const stats: [string, string][] = [
    ["총 태스크", `${tasks.length}건`],
    ["완료", `${done.length}건`],
    ["마감 준수율", withDue.length ? `${Math.round((onTime / withDue.length) * 100)}%` : "—"],
    ["평균 소요", durs.length ? `${avgH}시간` : "—"],
    ["재작업 합", `${rework}회`],
    ["등급", `우수 ${grades.우수}·양호 ${grades.양호}·보완 ${grades.보완}`],
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "start center", zIndex: 60, padding: "24px 16px", overflow: "auto" }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-sheet, .report-sheet * { visibility: visible !important; }
          .report-sheet { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="report-sheet card"
        style={{ width: "100%", maxWidth: 720, padding: 0, background: "#fff" }}
      >
        {/* 상단 바 (인쇄 시 숨김) */}
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <b style={{ fontSize: 14 }}>📄 프로젝트 리포트</b>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn primary sm" onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
            <button className="btn sm" onClick={onClose}>닫기</button>
          </span>
        </div>

        {/* 리포트 본문 */}
        <div style={{ padding: 28 }}>
          <div style={{ borderBottom: "2px solid #4f46e5", paddingBottom: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, letterSpacing: ".05em" }}>TMS · 프로젝트 완료 리포트</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 4px" }}>{project.name}</h1>
            <div style={{ fontSize: 13, color: "#4b5563" }}>
              기간 {fmt(project.startDate)} – {fmt(project.endDate)} · 상태 {project.status === "archived" ? "아카이브(완료)" : "진행중"}
            </div>
          </div>

          {project.overview && (
            <div style={{ fontSize: 13.5, color: "#374151", marginBottom: 18, lineHeight: 1.7 }}>{project.overview}</div>
          )}

          {/* 진행률 */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#6b7280", minWidth: 60 }}>최종 진행률</span>
              <div style={{ flex: 1, height: 10, background: "#eef0f2", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${project.progress}%`, height: "100%", background: progressColor(project.progress) }} />
              </div>
              <b style={{ fontSize: 14 }}>{project.progress}%</b>
            </div>
          </div>

          {/* 참여자 */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>참여자</div>
            <div style={{ fontSize: 13.5 }}>{members.length ? members.map((m) => m.user.name).join(" · ") : "—"}</div>
          </div>

          {/* 태스크 통계 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📊 태스크 통계</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {stats.map(([k, v]) => (
                <div key={k} style={{ background: "#f7f8fa", border: "1px solid #eceef2", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 편집 가능 섹션 */}
          {([
            ["summary", "✍️ 성과 요약"],
            ["issues", "⚠️ 이슈 · 특이사항"],
            ["next", "➡️ 다음 단계 / 비고"],
          ] as const).map(([k, label]) => (
            <div key={k} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label}</div>
              <textarea
                value={notes[k]}
                onChange={(e) => update(k, e.target.value)}
                placeholder="자유롭게 작성하세요 (자동 저장)"
                style={{ width: "100%", minHeight: 70, resize: "vertical", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.7, fontFamily: "inherit" }}
              />
            </div>
          ))}

          <div className="no-print" style={{ fontSize: 11.5, color: "#9aa0ab", marginTop: 6 }}>
            ※ 편집 내용은 이 브라우저에 자동 저장됩니다. 인쇄 시 위 상단바는 빠지고 리포트만 출력돼요.
          </div>
        </div>
      </div>
    </div>
  );
}
