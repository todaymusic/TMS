"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, progressColor, type ProjectDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import MembersEditor from "./MembersEditor";
import ProjectCalendar from "./ProjectCalendar";

function fmtRange(s: string | null, e: string | null): string {
  const f = (d: string | null) =>
    d
      ? `${new Date(d).getFullYear()}.${String(new Date(d).getMonth() + 1).padStart(2, "0")}.${String(new Date(d).getDate()).padStart(2, "0")}`
      : "";
  return [f(s), f(e)].filter(Boolean).join(" – ");
}

export default function ProjectHeader({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const { user: me } = useAuth();
  const links = project.links ?? [];
  const done = project.progress >= 100;
  const [showDesc, setShowDesc] = useState(false);
  const [promptArchive, setPromptArchive] = useState(done && project.status === "active");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // 프로젝트 삭제는 담당자(owner) 또는 관리자만
  const canDeleteProject =
    !!me && (!!me.isAdmin || project.owners.some((o) => o.user.id === me.id));

  async function removeProject() {
    setBusy(true);
    try {
      await api.del(`/projects/${project.id}`);
      router.push("/projects");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    project.status === "archived" ? "아카이브" : done ? "완료됨" : "진행중";
  const statusBg =
    project.status === "archived" ? "#e5e7eb" : done ? "#dcfce7" : "#e0e7ff";
  const statusFg =
    project.status === "archived" ? "#6b7280" : done ? "#15803d" : "#4338ca";

  async function changeStatus(status: "active" | "archived") {
    setBusy(true);
    try {
      await api.patch(`/projects/${project.id}`, { status });
      if (status === "archived") router.push("/projects");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card pinned">
      {promptArchive && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            marginBottom: 12,
            background: "#dcfce7",
            borderRadius: 8,
            fontSize: 13.5,
          }}
        >
          🎉 모든 업무가 완료됐어요! 이 프로젝트를 <b>아카이브</b>하시겠습니까?
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn primary sm" onClick={() => changeStatus("archived")} disabled={busy}>
              네, 아카이브
            </button>
            <button className="btn sm" onClick={() => setPromptArchive(false)}>
              나중에
            </button>
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* 좌: 핵심 정보 */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0 }}>{project.name}</h2>
            <span className="pill" style={{ background: statusBg, color: statusFg }}>
              {statusLabel}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <MembersEditor
                projectId={project.id}
                owners={project.owners}
                participants={project.participants}
              />
              <select
                className="inp"
                value={project.status}
                onChange={(e) => changeStatus(e.target.value as "active" | "archived")}
                disabled={busy}
                style={{ width: 92, fontSize: 12 }}
              >
                <option value="active">활성</option>
                <option value="archived">아카이브</option>
              </select>
              {canDeleteProject &&
                (confirmDel ? (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: "#dc2626", fontWeight: 700 }}>업무까지 전부 삭제?</span>
                    <button
                      className="btn sm"
                      style={{ color: "#fff", background: "#dc2626", borderColor: "#dc2626" }}
                      onClick={removeProject}
                      disabled={busy}
                    >
                      {busy ? "삭제 중…" : "삭제"}
                    </button>
                    <button className="btn sm" onClick={() => setConfirmDel(false)} disabled={busy}>취소</button>
                  </span>
                ) : (
                  <button
                    className="btn sm"
                    style={{ color: "#dc2626", borderColor: "#f0c9c9" }}
                    onClick={() => setConfirmDel(true)}
                    title="프로젝트 삭제 — 소속 업무·메시지까지 함께 삭제됩니다 (담당자/관리자)"
                  >
                    🗑 삭제
                  </button>
                ))}
            </span>
          </div>

          {project.overview && (
            <div
              style={{
                color: "var(--text-2)",
                fontSize: 13,
                marginTop: 6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {project.overview}
            </div>
          )}

          {/* 기간 · 진행률 · 참여자 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginTop: 14 }}>
            <div>
              <div className="field-lbl">기간</div>
              <div className="field-val">{fmtRange(project.startDate, project.endDate) || "—"}</div>
            </div>
            <div>
              <div className="field-lbl">진행률 (태스크 기준)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="prog" style={{ flex: 1 }}>
                  <i style={{ width: `${project.progress}%`, background: progressColor(project.progress) }} />
                </div>
                <b style={{ fontSize: 13 }}>{project.progress}%</b>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="field-lbl">참여자</div>
              <div className="field-val" style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13 }}>
                {[...project.owners, ...project.participants].length
                  ? [...project.owners, ...project.participants].map((m) => m.user.name).join(" · ")
                  : "—"}
              </div>
            </div>
          </div>

          {/* 업무설명 버튼 + 관련 데이터 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
            {project.description && (
              <button className="btn sm" onClick={() => setShowDesc(true)}>
                📄 업무설명 보기
              </button>
            )}
            {links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" className="link-chip">
                🔗 {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* 우: 작은 캘린더 */}
        <ProjectCalendar
          compact
          tasks={project.tasks}
          startDate={project.startDate}
          endDate={project.endDate}
        />
      </div>

      {/* 업무설명 모달 */}
      {showDesc && (
        <div
          onClick={() => setShowDesc(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto", padding: 24 }}>
            <div className="sec-title mb16">
              <span className="em">📄</span> {project.name} — 업무 설명
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "var(--text-2)" }}>
              {project.description}
            </div>
            <button className="btn primary" style={{ marginTop: 18 }} onClick={() => setShowDesc(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
