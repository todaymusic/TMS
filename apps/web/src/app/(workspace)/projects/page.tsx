"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { api, progressColor, type ProjectListItem, type Member } from "@/lib/api";
import NewProjectModal from "./NewProjectModal";
import ProjectReportModal from "./ProjectReportModal";

function fmt(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function dday(end: string | null): string {
  if (!end) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "마감 D-Day";
  return diff > 0 ? `마감 D-${diff}` : `마감 D+${-diff}`;
}

function MemberStack({ members }: { members: Member[] }) {
  const shown = members.slice(0, 4);
  return (
    <div className="proj-mem">
      <div className="stack">
        {shown.map((m) => (
          <div key={m.id} className="avatar" style={{ background: m.user.avatarColor }}>
            {m.user.name.slice(0, 1)}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 12, color: "var(--text-2)" }}>
        {members.map((m) => m.user.name).join(" · ")}
      </span>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "upcoming" | "archived">("active");
  const [q, setQ] = useState("");
  const [reportProject, setReportProject] = useState<ProjectListItem | null>(null);

  useEffect(() => {
    api
      .get<ProjectListItem[]>("/projects")
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오기 실패"));
  }, []);

  const now = Date.now();
  const byDeadline = (a: ProjectListItem, b: ProjectListItem) => {
    const ea = a.endDate ? new Date(a.endDate).getTime() : Infinity;
    const eb = b.endDate ? new Date(b.endDate).getTime() : Infinity;
    return ea - eb;
  };
  const matchQ = (p: ProjectListItem) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      [...p.owners, ...p.participants].some((m) => m.user.name.toLowerCase().includes(term))
    );
  };

  const { inProgress, upcoming, archived } = useMemo(() => {
    const activeAll = projects.filter((p) => p.status === "active");
    return {
      inProgress: activeAll.filter((p) => !p.startDate || new Date(p.startDate).getTime() <= now).sort(byDeadline),
      upcoming: activeAll.filter((p) => p.startDate && new Date(p.startDate).getTime() > now).sort(byDeadline),
      archived: projects
        .filter((p) => p.status === "archived")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const shown = (tab === "active" ? inProgress : tab === "upcoming" ? upcoming : archived).filter(matchQ);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">
            진행중 {inProgress.length} · 진행예정 {upcoming.length} · 아카이브 {archived.length}
          </div>
        </div>
        <div className="topbar-right">
          <div className="search" style={{ position: "relative" }}>
            🔍
            <input placeholder="프로젝트 · 참여자 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="content">
        {error && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {error}
          </div>
        )}

        {/* 진행중 / 진행예정 / 아카이브 탭 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {([
            ["active", `🟢 진행중 ${inProgress.length}`],
            ["upcoming", `🗓️ 진행예정 ${upcoming.length}`],
            ["archived", `📦 아카이브 ${archived.length}`],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`btn${tab === k ? " primary" : ""}`}
              style={{ fontSize: 13 }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "archived" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {shown.length === 0 && (
              <div className="card" style={{ color: "var(--text-3)", fontSize: 13 }}>
                {q.trim() ? "검색 결과가 없어요." : "아카이브된 프로젝트가 없어요."}
              </div>
            )}
            {shown.map((p) => (
              <div key={p.id} className="archive-bar">
                <span style={{ fontSize: 14 }}>📦</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {fmt(p.startDate)} – {fmt(p.endDate)} · 완료 {p.progress}%
                  </div>
                </div>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <Link href={`/projects/${p.id}`} className="btn sm">열기</Link>
                  <button className="btn primary sm" onClick={() => setReportProject(p)}>📄 리포트</button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="proj-grid">
            {shown.map((p) => {
              const members = [...p.owners, ...p.participants];
              const upcomingCard = tab === "upcoming";
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="card proj-card">
                  <div className="top">
                    <span className="dot on" style={upcomingCard ? { background: "#f59e0b" } : undefined} />
                    <h3>{p.name}</h3>
                    <span
                      className={`pill ${upcomingCard ? "gray" : "indigo"}`}
                      style={{ marginLeft: "auto", ...(upcomingCard ? { background: "#fef3c7", color: "#a16207" } : {}) }}
                    >
                      {upcomingCard ? "진행예정" : "진행중"}
                    </span>
                  </div>
                  <div className="meta">
                    {fmt(p.startDate)} – {fmt(p.endDate)}
                    {upcomingCard && p.startDate ? ` · 시작 ${fmt(p.startDate)}` : p.endDate ? ` · ${dday(p.endDate)}` : ""}
                  </div>
                  <div className="prog mb16">
                    <i style={{ width: `${p.progress}%`, background: progressColor(p.progress) }} />
                  </div>
                  <MemberStack members={members} />
                </Link>
              );
            })}

            {shown.length === 0 && (
              <div className="card" style={{ color: "var(--text-3)", fontSize: 13, display: "grid", placeItems: "center", minHeight: 120 }}>
                {q.trim() ? "검색 결과가 없어요." : tab === "active" ? "진행중 프로젝트가 없어요." : "진행예정 프로젝트가 없어요."}
              </div>
            )}

            {tab === "active" && !q.trim() && <NewProjectModal />}
          </div>
        )}
      </div>

      {reportProject && (
        <ProjectReportModal project={reportProject} onClose={() => setReportProject(null)} />
      )}
    </>
  );
}
