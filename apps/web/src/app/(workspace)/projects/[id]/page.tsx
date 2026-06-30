import Link from "next/link";
import AiSummaryCard from "./AiSummaryCard";
import Kanban from "./Kanban";
import ProjectHeader from "./ProjectHeader";
import ProjectThread from "./ProjectThread";
import { api, type Message, type ProjectDetail } from "@/lib/api";

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

        {/* 간소화 헤더 + 작은 캘린더 */}
        <ProjectHeader project={project} />

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
          <Kanban
            projectId={project.id}
            initial={project.tasks}
            members={[...project.owners, ...project.participants].map((m) => ({
              id: m.user.id,
              name: m.user.name,
            }))}
          />
        </div>
      </div>
    </>
  );
}
