"use client";

import { useState } from "react";
import { TEAM, STATUS_LABEL, progressColor, type Status } from "@/lib/mock";

// 업무 대분류 (category)
const CATEGORIES = [
  { key: "long", ic: "⏳", label: "롱", desc: "긴 업무" },
  { key: "shorts", ic: "⚡", label: "쇼츠", desc: "짧은 업무" },
  { key: "project", ic: "📁", label: "프로젝트" },
] as const;

// 소분류 (업무 영역) — 프랜차이즈 기업 기준
const SUBCATS = ["디자인", "개발", "마케팅", "기획", "지점업무", "교육", "운영", "인사·총무"];

const PRIOS = [
  { key: "urgent", label: "긴급" },
  { key: "high", label: "높음" },
  { key: "medium", label: "보통" },
  { key: "low", label: "낮음" },
] as const;

const DEFAULT_AI_PROMPT = `당신은 업무 정의 어시스턴트입니다. 아래 간략 메모를 바탕으로 담당자가 바로 이해하고 착수할 수 있는 업무설명 문서를 작성하세요.
출력: 1) 배경/목적  2) 목표(완료기준)  3) 작업범위  4) 요구 산출물  5) 체크포인트/마감`;

const ASSIGNEES = ["김서연", "이준호", "박민지", "최우진"];
const PRESETS: Status[] = ["on", "away", "dnd", "off"];

export default function DashboardPage() {
  const [category, setCategory] = useState<string>("long");
  const [subcat, setSubcat] = useState<string>("디자인");
  const [prio, setPrio] = useState<string>("high");
  const [needReport, setNeedReport] = useState<boolean>(true);
  const [needVideo, setNeedVideo] = useState<boolean>(false);
  const [assignees, setAssignees] = useState<string[]>(["김서연"]);
  const [description, setDescription] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>(DEFAULT_AI_PROMPT);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [myStatus, setMyStatus] = useState<Status>("on");

  const toggleAssignee = (name: string) =>
    setAssignees((a) => (a.includes(name) ? a.filter((x) => x !== name) : [...a, name]));

  const isProject = category === "project";
  const outputHint = [
    needReport ? "보고 형식 안내 (예: 주차별 진행률 포함)" : null,
    needVideo ? "영상에 담을 항목 (예: 결과 시연 / 코드 설명)" : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <div className="topbar">
        <div>
          <h1>대시보드</h1>
          <div className="sub">팀 실시간 현황 · 2026년 6월 26일 금요일</div>
        </div>
        <div className="topbar-right">
          <div className="search">🔍<input placeholder="태스크 · 프로젝트 검색" /></div>
          <div className="avatar" style={{ background: "#4f46e5" }}>나</div>
        </div>
      </div>

      <div className="content">
        <div className="dash-grid">
          {/* A. 실시간 업무현황 */}
          <div className="card">
            <div className="panel-head">
              <div className="sec-title"><span className="em">🟢</span> 실시간 업무현황</div>
              <span className="live"><span className="ping" />LIVE</span>
              <span className="count">접속 5명</span>
            </div>
            <div className="team-grid">
              {TEAM.map((m) => (
                <div className="member" key={m.name}>
                  <div className="member-top">
                    <div className="member-av">
                      <div className="avatar" style={{ background: m.color, width: 36, height: 36 }}>{m.name[0]}</div>
                      <span className={`dot ${m.st}`} />
                    </div>
                    <div>
                      <div className="member-name">{m.name}</div>
                      <div className="member-dept">{m.dept}</div>
                    </div>
                    <span className="pill gray" style={{ marginLeft: "auto" }}>{m.proj}</span>
                  </div>
                  <div className="member-task">
                    {m.st === "off" ? "오프라인" : "진행중 · "}
                    <b>{m.st === "off" ? "" : m.task}</b>
                  </div>
                  <div className="member-foot">
                    <div className="prog" style={{ flex: 1 }}>
                      <i style={{ width: `${m.pct}%`, background: progressColor(m.pct) }} />
                    </div>
                    <span className="pct" style={{ color: progressColor(m.pct) }}>{m.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-right">
            {/* B. 업무 부여 */}
            <div className="card">
              <div className="panel-head"><div className="sec-title"><span className="em">📋</span> 업무 부여</div></div>

              {/* 1. 업무 대분류 */}
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
                  <button className="btn" style={{ width: "100%", marginTop: 8 }}>프로젝트 탭에서 생성하기 →</button>
                </div>
              ) : (
                <>
                  {/* 2. 소분류 (업무 영역) */}
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

                  {/* 3. 우선순위 */}
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

                  {/* 4. 산출물 요구 (체크박스) */}
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

                  {/* 5. 담당자 */}
                  <div className="assign-field">
                    <label>담당자</label>
                    <div className="chips">
                      {ASSIGNEES.map((name) => (
                        <span
                          key={name}
                          className={`chip${assignees.includes(name) ? " on" : ""}`}
                          onClick={() => toggleAssignee(name)}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 6. 태스크 제목 */}
                  <div className="assign-field">
                    <label>태스크 제목</label>
                    <input className="inp" placeholder="예: 6월 신메뉴 포스터 디자인" />
                  </div>

                  {/* 7-8. 마감일 / 프로젝트 */}
                  <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label>마감일</label>
                      <input className="inp" type="date" defaultValue="2026-07-03" />
                    </div>
                    <div>
                      <label>프로젝트</label>
                      <select className="inp">
                        <option>연결 안 함</option>
                        <option>웹 리뉴얼</option>
                        <option>앱 v2.0</option>
                      </select>
                    </div>
                  </div>

                  {/* 9. 상세 설명 */}
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

                  {/* 10. AI 정리 프롬프트 */}
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
                    <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }}>
                      🤖 AI 업무설명 doc 생성
                    </button>
                  </div>

                  <div className="assign-field">
                    <button className="btn primary" style={{ width: "100%" }}>태스크 부여하고 알림 보내기</button>
                  </div>
                </>
              )}
            </div>

            {/* C. 내 상태 변경 */}
            <div className="card">
              <div className="panel-head"><div className="sec-title"><span className="em">🎯</span> 내 상태 변경</div></div>
              <div className="status-presets">
                {PRESETS.map((s) => (
                  <div
                    key={s}
                    className={`preset${myStatus === s ? " on" : ""}`}
                    onClick={() => setMyStatus(s)}
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
