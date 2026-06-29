import Link from "next/link";
import { api, progressColor, type ProjectListItem, type Member } from "@/lib/api";

function fmt(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
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
          <div
            key={m.id}
            className="avatar"
            style={{ background: m.user.avatarColor }}
          >
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

export default async function ProjectsPage() {
  let projects: ProjectListItem[] = [];
  let error: string | null = null;
  try {
    projects = await api.get<ProjectListItem[]>("/projects");
  } catch (e) {
    error = e instanceof Error ? e.message : "불러오기 실패";
  }

  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");

  return (
    <>
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">
            활성 프로젝트 {active.length} · 아카이브 {archived.length}
          </div>
        </div>
      </div>

      <div className="content">
        {error && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {error}
          </div>
        )}

        <div className="proj-grid">
          {active.map((p) => {
            const members = [...p.owners, ...p.participants];
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="card proj-card"
              >
                <div className="top">
                  <span className="dot on" />
                  <h3>{p.name}</h3>
                  <span className="pill indigo" style={{ marginLeft: "auto" }}>
                    진행중
                  </span>
                </div>
                <div className="meta">
                  {fmt(p.startDate)} – {fmt(p.endDate)}
                  {p.endDate ? ` · ${dday(p.endDate)}` : ""}
                </div>
                <div className="prog mb16">
                  <i
                    style={{
                      width: `${p.progress}%`,
                      background: progressColor(p.progress),
                    }}
                  />
                </div>
                <MemberStack members={members} />
              </Link>
            );
          })}

          <div className="card proj-card new-proj">＋ 새 프로젝트</div>
        </div>

        {archived.length > 0 && (
          <div className="archive-sec">
            <div className="sec-title mb16">
              <span className="em">📦</span> 아카이브
            </div>
            {archived.map((p) => (
              <div key={p.id} className="archive-bar">
                <span style={{ fontSize: 14 }}>📦</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {fmt(p.startDate)} – {fmt(p.endDate)} · 완료
                  </div>
                </div>
                <span className="pill gray">읽기 전용</span>
                <button className="btn sm" style={{ marginLeft: "auto" }}>
                  PDF 리포트
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
