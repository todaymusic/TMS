"use client";

import { useEffect, useState } from "react";
import {
  api,
  progressColor,
  STATUS_LABEL,
  type ProjectListItem,
  type Task,
  type User,
  type UserStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// 업무 대분류 (category)
const CATEGORIES = [
  { key: "long", ic: "⏳", label: "롱", desc: "긴 업무" },
  { key: "shorts", ic: "⚡", label: "쇼츠", desc: "짧은 업무" },
  { key: "project", ic: "📁", label: "프로젝트" },
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

const PRESETS: UserStatus[] = ["on", "away", "dnd", "off"];

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

  const [myStatus, setMyStatus] = useState<UserStatus>("on");

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

  const isProject = category === "project";
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
      });
      setSubmitMsg("✅ 업무를 부여했습니다");
      setTitle("");
      setDescription("");
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
          <div className="search">
            🔍<input placeholder="태스크 · 프로젝트 검색" />
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
                    <div className="member" key={m.id}>
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
                      <div className="member-foot">
                        <div className="prog" style={{ flex: 1 }}>
                          <i style={{ width: `${pct}%`, background: progressColor(pct) }} />
                        </div>
                        <span className="pct" style={{ color: progressColor(pct) }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
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

              {isProject ? (
                <div className="assign-field">
                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "12px 13px",
                      fontSize: 12.5,
                      color: "var(--text-2)",
                      lineHeight: 1.5,
                    }}
                  >
                    📁 프로젝트는 여기서 바로 부여할 수 없어요. <b>프로젝트 탭에서 먼저 생성</b>하고 담당자/참여자를 추가하세요.
                  </div>
                  <a href="/projects" className="btn" style={{ width: "100%", marginTop: 8, display: "block", textAlign: "center" }}>
                    프로젝트 탭에서 생성하기 →
                  </a>
                </div>
              ) : (
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

                  <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label>마감일</label>
                      <input
                        className="inp"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>프로젝트</label>
                      <select
                        className="inp"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="">연결 안 함</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} disabled>
                      🤖 AI 업무설명 doc 생성 (연동 예정)
                    </button>
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

            {/* C. 내 상태 변경 */}
            <div className="card">
              <div className="panel-head">
                <div className="sec-title">
                  <span className="em">🎯</span> 내 상태 변경
                </div>
              </div>
              <div className="status-presets">
                {PRESETS.map((s) => (
                  <div
                    key={s}
                    className={`preset${myStatus === s ? " on" : ""}`}
                    onClick={async () => {
                      setMyStatus(s);
                      if (me) {
                        try {
                          await api.patch(`/users/${me.id}`, { status: s });
                          await load();
                        } catch {
                          /* noop */
                        }
                      }
                    }}
                  >
                    <span className={`dot ${s}`} />
                    <span className="nm">{STATUS_LABEL[s]}</span>
                    <span className="check">✓</span>
                  </div>
                ))}
                <div style={{ paddingTop: 4 }}>
                  <input className="inp" placeholder="커스텀 상태 메시지 (예: 회의 중 3시까지)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
