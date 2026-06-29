import Link from "next/link";
import AiSummaryCard from "./AiSummaryCard";
import MembersEditor from "./MembersEditor";
import ProjectThread from "./ProjectThread";
import {
  api,
  progressColor,
  type Message,
  type Priority,
  type ProjectDetail,
  type TaskStatus,
  type TaskInProject,
} from "@/lib/api";

const PRI: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "긴급", cls: "u" },
  high: { label: "높음", cls: "h" },
  medium: { label: "보통", cls: "m" },
  low: { label: "낮음", cls: "l" },
};

const ROLE_LABEL: Record<string, string> = {
  lead: "리드",
  design: "디자인",
  dev: "개발",
  etc: "기타",
};

const COLS: { key: TaskStatus | "done"; label: string; emoji: string }[] = [
  { key: "todo", label: "할일", emoji: "📥" },
  { key: "doing", label: "진행중", emoji: "🔄" },
  { key: "review", label: "검토중", emoji: "👀" },
  { key: "done", label: "완료", emoji: "✅" },
];

function fmtRange(s: string | null, e: string | null): string {
  const f = (d: string | null) =>
    d
      ? `${new Date(d).getFullYear()}.${String(new Date(d).getMonth() + 1).padStart(2, "0")}.${String(new Date(d).getDate()).padStart(2, "0")}`
      : "";
  return [f(s), f(e)].filter(Boolean).join(" – ");
}

function md(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function colTasks(tasks: TaskInProject[], key: TaskStatus | "done") {
  if (key === "done")
    return tasks.filter(
      (t) => t.status === "done" || t.status === "completed_pending",
    );
  return tasks.filter((t) => t.status === key);
}

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let project: ProjectDetail | null = null;
  let messages: Message[] = [];
  let error: string | null = null;
  try {
    project = await api.get<ProjectDetail>(`/projects/${id}`);
    messages = await api.get<Message[]>(`/messages?projectId=${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "불러오기 실패";
  }

  if (error || !project) {
    return (
      <>
        <div className="topbar">
          <div>
            <h1>프로젝트</h1>
            <div className="sub">불러오기 실패</div>
          </div>
        </div>
        <div className="content">
          <Link href="/projects" className="detail-back">
            ← 프로젝트 목록으로
          </Link>
          <div className="card" style={{ color: "#dc2626" }}>
            프로젝트를 불러오지 못했습니다. {error}
          </div>
        </div>
      </>
    );
  }

  const links = project.links ?? [];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">{project.name}</div>
        </div>
      </div>

      <div className="content">
        <Link href="/projects" className="detail-back">
          ← 프로젝트 목록으로
        </Link>

        {/* 고정 상단 */}
        <div className="card pinned">
          <div className="pinned-top">
            <div>
              <h2>{project.name}</h2>
              {project.overview && (
                <div className="overview">{project.overview}</div>
              )}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <MembersEditor
                projectId={project.id}
                owners={project.owners}
                participants={project.participants}
              />
              <span className="pill indigo">
                {project.status === "active" ? "진행중" : "아카이브"}
              </span>
            </div>
          </div>
          <div className="pinned-grid">
            <div>
              <div className="field-lbl">기간</div>
              <div className="field-val">
                {fmtRange(project.startDate, project.endDate) || "—"}
              </div>
            </div>
            <div>
              <div className="field-lbl">진행률</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="prog" style={{ flex: 1 }}>
                  <i
                    style={{
                      width: `${project.progress}%`,
                      background: progressColor(project.progress),
                    }}
                  />
                </div>
                <b style={{ fontSize: 13 }}>{project.progress}%</b>
              </div>
            </div>
            <div>
              <div className="field-lbl">담당자 맵핑</div>
              <div className="role-map">
                {project.owners.length === 0 && (
                  <span style={{ color: "var(--text-3)" }}>—</span>
                )}
                {project.owners.map((o) => (
                  <span key={o.id}>
                    {ROLE_LABEL[o.role ?? "etc"] ?? o.role} ·{" "}
                    <b>{o.user.name}</b>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="field-lbl">참여자</div>
              <div
                className="field-val"
                style={{
                  fontWeight: 400,
                  color: "var(--text-2)",
                  fontSize: 13,
                }}
              >
                {project.participants.length
                  ? project.participants.map((p) => p.user.name).join(" · ")
                  : "—"}
              </div>
            </div>
            {project.description && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="field-lbl">업무 설명</div>
                <div
                  className="field-val"
                  style={{
                    fontWeight: 400,
                    color: "var(--text-2)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {project.description}
                </div>
              </div>
            )}
            {links.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="field-lbl">관련 데이터</div>
                <div className="links">
                  {links.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="link-chip"
                    >
                      🔗 {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 상단 2단: AI 요약 + 커뮤니케이션 */}
        <div className="detail-cols">
          <AiSummaryCard
            projectId={project.id}
            initial={project.aiSummary as Parameters<typeof AiSummaryCard>[0]["initial"]}
          />

          <ProjectThread
            projectId={project.id}
            initial={messages}
            members={[...project.owners, ...project.participants].map((m) => ({
              id: m.user.id,
              name: m.user.name,
            }))}
          />
        </div>

        {/* 태스크 보드 — 전체 너비 */}
        <div className="card" style={{ padding: "16px 18px", marginTop: 18 }}>
          <div className="sec-title mb16">
            <span className="em">📋</span> 태스크 보드
          </div>
          <div className="kanban">
            {COLS.map((col) => {
              const items = colTasks(project.tasks, col.key);
              return (
                <div key={col.key} className="kcol">
                  <div className="kcol-head">
                    {col.emoji} {col.label} <span className="n">{items.length}</span>
                  </div>
                  {items.map((t) => (
                    <div key={t.id} className="kcard">
                      <div className="kt">{t.title}</div>
                      <div className="kf">
                        <span className={`pri ${PRI[t.priority].cls}`}>
                          {PRI[t.priority].label}
                        </span>
                        {t.dueDate && <span className="dd">{md(t.dueDate)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            ↔ 카드를 드래그해 상태를 변경할 수 있어요 (드래그 연동 예정)
          </div>
        </div>
      </div>
    </>
  );
}
