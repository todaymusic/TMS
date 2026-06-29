"use client";

import { useState } from "react";
import { TEAM, STATUS_LABEL, progressColor, type Status } from "@/lib/mock";

const CATEGORIES = [
  { key: "long", ic: "🎬", label: "롱" },
  { key: "shorts", ic: "⚡", label: "쇼츠" },
  { key: "project", ic: "📁", label: "프로젝트" },
] as const;

const PRIOS = [
  { key: "urgent", label: "긴급" },
  { key: "high", label: "높음" },
  { key: "medium", label: "보통" },
  { key: "low", label: "낮음" },
] as const;

const ASSIGNEES = ["김서연", "이준호", "박민지", "최우진"];
const PRESETS: Status[] = ["on", "away", "dnd", "off"];

export default function DashboardPage() {
  const [category, setCategory] = useState<string>("long");
  const [assignees, setAssignees] = useState<string[]>(["김서연"]);
  const [prio, setPrio] = useState<string>("high");
  const [myStatus, setMyStatus] = useState<Status>("on");

  const toggleAssignee = (name: string) =>
    setAssignees((a) => (a.includes(name) ? a.filter((x) => x !== name) : [...a, name]));

  const isProject = category === "project";

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
                  <div className="assign-field">
                    <label>태스크 제목</label>
                    <input className="inp" placeholder="예: 랜딩 페이지 반응형 작업" />
                  </div>
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
