"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  progressColor,
  type ProjectListItem,
  type Task,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// 업무 대분류 (category) — 대시보드는 롱/쇼츠만(프로젝트는 프로젝트 탭에서)
const CATEGORIES = [
  { key: "long", ic: "⏳", label: "롱", desc: "긴 업무" },
  { key: "shorts", ic: "⚡", label: "쇼츠", desc: "짧은 업무" },
] as const;

const SUBCATS = ["디자인", "개발", "마케팅", "기획", "지점업무", "교육", "운영", "인사·총무"];

const PRIOS = [
  { key: "urgent", label: "긴급" },
  { key: "high", label: "높음" },
  { key: "medium", label: "보통" },
  { key: "low", label: "낮음" },
] as const;

const DEFAULT_AI_PROMPT = `당신은 업무 정의 어시스턴트입니다. 아래 간략 메모를 바탕으로 담당자가 바로 이해하고 착수할 수 있는 업무설명 문서를 작성하세요.
출력: 1) 배경/목적  2) 목표(완료기준)  3) 작업범위  4) 요구 산출물  5) 체크포인트/마감`;

export default function DashboardPage() {
  // 서버 데이터
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 업무 부여 폼
  const [category, setCategory] = useState<string>("long");
  const [subcat, setSubcat] = useState<string>("디자인");
  const [prio, setPrio] = useState<string>("high");
  const [needReport, setNeedReport] = useState<boolean>(true);
  const [needVideo, setNeedVideo] = useState<boolean>(false);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>(DEFAULT_AI_PROMPT);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [aiDoc, setAiDoc] = useState<string>("");
  const [aiBusy, setAiBusy] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [q, setQ] = useState("");
  const router = useRouter();

  // 로그인한 사용자 = "나(부여자)"
  const { user: me } = useAuth();

  async function load() {
    setLoading(true);
    setLoadErr(null);
    try {
      const [u, t, p] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<Task[]>("/tasks"),
        api.get<ProjectListItem[]>("/projects"),
      ]);
      setUsers(u);
      setTasks(t);
      setProjects(p);
      if (!assigneeId && u[0]) setAssigneeId(u[0].id);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputHint = [
    needReport ? "보고 형식 안내 (예: 주차별 진행률 포함)" : null,
    needVideo ? "영상에 담을 항목 (예: 결과 시연 / 코드 설명)" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // 각 사용자의 현재 진행중(doing) 업무
  const doingByUser = new Map<string, Task>();
  for (const t of tasks) {
    if (t.status === "doing" && t.assignee && !doingByUser.has(t.assignee.id)) {
      doingByUser.set(t.assignee.id, t);
    }
  }
  const onlineCount = users.filter((u) => u.status !== "off").length;

  // 검색: 프로젝트명 / 태스크 제목·업무영역
  const search = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { projects: [], tasks: [] };
    return {
      projects: projects.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 5),
      tasks: tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(term) ||
            (t.subCategory?.toLowerCase().includes(term) ?? false),
        )
        .slice(0, 8),
    };
  }, [q, projects, tasks]);
  const hasResults = search.projects.length > 0 || search.tasks.length > 0;

  async function generateDoc() {
    if (!description.trim()) {
      setSubmitMsg("AI 정리할 상세 설명(메모)을 먼저 입력하세요");
      return;
    }
    setAiBusy(true);
    try {
      const r = await api.post<{ doc: string }>("/ai/task-doc", {
        memo: description,
        prompt: aiPrompt,
        title,
        category,
        subCategory: subcat,
      });
      setAiDoc(r.doc);
    } catch (e) {
      setAiDoc(`(생성 실패: ${e instanceof Error ? e.message : "오류"})`);
    } finally {
      setAiBusy(false);
    }
  }

  async function submitTask() {
    if (!title.trim()) {
      setSubmitMsg("제목을 입력하세요");
      return;
    }
    if (!assigneeId) {
      setSubmitMsg("담당자를 선택하세요");
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await api.post<Task>("/tasks", {
        title: title.trim(),
        category,
        subCategory: subcat,
        priority: prio,
        reportRequired: needReport,
        videoRequired: needVideo,
        assigneeId,
        assignerId: me?.id,
        projectId: projectId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        description: description.trim() || undefined,
        descriptionPrompt: aiPrompt.trim() || undefined,
        aiDescriptionDoc: aiDoc.trim() || undefined,
      });
      setSubmitMsg("✅ 업무를 부여했습니다");
      setTitle("");
      setDescription("");
      setAiDoc("");
      await load();
    } catch (e) {
      setSubmitMsg(e instanceof Error ? e.message : "부여 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>대시보드</h1>
          <div className="sub">팀 실시간 현황 · 2026년 6월 29일</div>
        </div>
        <div className="topbar-right">
          <Link href="/links" className="btn" title="업무에 필요한 공용 링크 모음">
            🔗 링크
          </Link>
          <div className="search" style={{ position: "relative" }}>
            🔍
            <input
              placeholder="태스크 · 프로젝트 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q.trim() && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 320,
                  maxHeight: 360,
                  overflow: "auto",
                  background: "var(--surface, #fff)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  zIndex: 40,
                  padding: 6,
                }}
              >
                {!hasResults && (
                  <div style={{ padding: 12, fontSize: 13, color: "var(--text-3)" }}>
                    검색 결과가 없어요.
                  </div>
                )}
                {search.projects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      router.push(`/projects/${p.id}`);
                      setQ("");
                    }}
                    style={{ padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13.5 }}
                  >
                    📁 {p.name}
                  </div>
                ))}
                {search.tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (t.project) router.push(`/projects/${t.project.id}`);
                      setQ("");
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      cursor: t.project ? "pointer" : "default",
                      fontSize: 13.5,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    📋 {t.title}
                    {t.project && (
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>
                        {t.project.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="avatar" style={{ background: me?.avatarColor ?? "#4f46e5" }}>
            {me ? me.name.slice(0, 1) : "나"}
          </div>
        </div>
      </div>

      <div className="content">
        {loadErr && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {loadErr}
          </div>
        )}
        <div className="dash-grid">
          {/* A. 실시간 업무현황 */}
          <div className="card">
            <div className="panel-head">
              <div className="sec-title">
                <span className="em">🟢</span> 실시간 업무현황
              </div>
              <span className="live">
                <span className="ping" />
                LIVE
              </span>
              <span className="count">접속 {onlineCount}명</span>
            </div>
            <div className="team-grid">
              {loading && <div style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</div>}
              {!loading &&
                users.map((m) => {
                  const task = doingByUser.get(m.id);
                  const pct = task?.progress ?? 0;
                  return (
                    <Link
                      className="member"
                      key={m.id}
                      href={`/activity?userId=${m.id}`}
                      title={`${m.name}님의 활동 보기`}
                      style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                    >
                      <div className="member-top">
                        <div className="member-av">
                          <div
                            className="avatar"
                            style={{ background: m.avatarColor, width: 36, height: 36 }}
                          >
                            {m.name.slice(0, 1)}
                          </div>
                          <span className={`dot ${m.status}`} />
                        </div>
                        <div>
                          <div className="member-name">{m.name}</div>
                          <div className="member-dept">{m.dept ?? ""}</div>
                        </div>
                        <span className="pill gray" style={{ marginLeft: "auto" }}>
                          {task?.project?.name ?? "—"}
                        </span>
                      </div>
                      <div className="member-task">
                        {m.status === "off"
                          ? "오프라인"
                          : task
                            ? "진행중 · "
                            : "대기 중"}
                        <b>{m.status === "off" ? "" : (task?.title ?? "")}</b>
                      </div>
                      {task?.statusMemo && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-3)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          📝 {task.statusMemo}
                        </div>
                      )}
                      <div className="member-foot">
                        <div className="prog" style={{ flex: 1 }}>
                          <i style={{ width: `${pct}%`, background: progressColor(pct) }} />
                        </div>
                        <span className="pct" style={{ color: progressColor(pct) }}>
                          {pct}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>

          <div className="dash-right">
            {/* B. 업무 부여 */}
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">📋</span> 업무 부여
                </div>
              </div>

              <div className="assign-field">
                <label>업무 대분류</label>
                <div className="cat-row">
                  {CATEGORIES.map((c) => (
                    <div
                      key={c.key}
                      className={`cat${category === c.key ? " on" : ""}`}
                      onClick={() => setCategory(c.key)}
                    >
                      {c.ic} {c.label}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="btn"
                style={{ width: "100%", marginBottom: 12 }}
                onClick={() => setShowDetail((s) => !s)}
              >
                {showDetail ? "▲ 상세 입력 접기" : "✏️ 상세 입력 (담당자·제목·마감일 등)"}
              </button>

              {showDetail && (
                <>
                  <div className="assign-field">
                    <label>소분류 (업무 영역)</label>
                    <div className="chips">
                      {SUBCATS.map((s) => (
                        <span
                          key={s}
                          className={`chip${subcat === s ? " on" : ""}`}
                          onClick={() => setSubcat(s)}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="assign-field">
                    <label>우선순위</label>
                    <div className="prio-row">
                      {PRIOS.map((p) => (
                        <div
                          key={p.key}
                          className={`prio ${p.key}${prio === p.key ? " on" : ""}`}
                          onClick={() => setPrio(p.key)}
                        >
                          {p.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="assign-field">
                    <label>산출물 요구</label>
                    <div className="chk-row">
                      <label className="chk">
                        <input type="checkbox" checked={needReport} onChange={(e) => setNeedReport(e.target.checked)} />
                        📊 보고링크
                      </label>
                      <label className="chk">
                        <input type="checkbox" checked={needVideo} onChange={(e) => setNeedVideo(e.target.checked)} />
                        🎥 설명영상
                      </label>
                    </div>
                  </div>

                  <div className="assign-field">
                    <label>담당자</label>
                    <div className="chips">
                      {users.map((u) => (
                        <span
                          key={u.id}
                          className={`chip${assigneeId === u.id ? " on" : ""}`}
                          onClick={() => setAssigneeId(u.id)}
                        >
                          {u.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="assign-field">
                    <label>태스크 제목</label>
                    <input
                      className="inp"
                      placeholder="예: 6월 신메뉴 포스터 디자인"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="assign-field">
                    <label>마감일</label>
                    <input
                      className="inp"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <div className="assign-field">
                    <label>상세 설명 (간략 메모)</label>
                    <textarea
                      className="inp"
                      placeholder="업무를 간략히 적으면 AI가 정돈된 업무설명 doc으로 만들어줘요"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    {outputHint && <div className="field-hint">💡 {outputHint}</div>}
                  </div>

                  <div className="assign-field">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <label style={{ margin: 0 }}>상세 설명 프롬프트 (AI 정리)</label>
                      <button
                        type="button"
                        className="btn sm"
                        style={{ marginLeft: "auto", padding: "3px 9px" }}
                        onClick={() => setShowPrompt((s) => !s)}
                      >
                        {showPrompt ? "숨기기" : "프롬프트 수정"}
                      </button>
                    </div>
                    {showPrompt && (
                      <textarea
                        className="inp"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        style={{ minHeight: 96 }}
                      />
                    )}
                    <button
                      type="button"
                      className="btn"
                      style={{ width: "100%", marginTop: 8 }}
                      onClick={generateDoc}
                      disabled={aiBusy}
                    >
                      {aiBusy ? "생성 중…" : "🤖 AI 업무설명 doc 생성"}
                    </button>
                    {aiDoc && (
                      <textarea
                        className="inp"
                        value={aiDoc}
                        onChange={(e) => setAiDoc(e.target.value)}
                        style={{ minHeight: 140, marginTop: 8 }}
                      />
                    )}
                    {aiDoc && (
                      <div className="field-hint">
                        ✏️ 생성된 업무설명 doc — 수정 가능, 부여 시 함께 저장됩니다
                      </div>
                    )}
                  </div>

                  <div className="assign-field">
                    {submitMsg && (
                      <div
                        className="field-hint"
                        style={{ color: submitMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}
                      >
                        {submitMsg}
                      </div>
                    )}
                    <button
                      className="btn primary"
                      style={{ width: "100%" }}
                      onClick={submitTask}
                      disabled={submitting}
                    >
                      {submitting ? "부여 중…" : "태스크 부여하고 알림 보내기"}
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
