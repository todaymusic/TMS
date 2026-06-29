// 캘린더 — 월별 뷰 + 프로젝트 타임라인(간트). Phase 1 쉘(목업).
type Ev = [kind: "done" | "prog" | "late", text: string];

const EVENTS: Record<number, Ev[]> = {
  1: [["done", "김:디자인 토큰 ✅"], ["prog", "박:온보딩 🔄"]],
  3: [["prog", "이:리팩토링 📝"]],
  5: [["prog", "최:API 작업"]],
  12: [["late", "정:QA 지연 ⚠️"]],
  18: [["prog", "김:QA 시작"]],
  20: [["done", "웹 리뉴얼 마감"]],
  26: [["prog", "이:히어로 개발"]],
};

const DOWS = ["월", "화", "수", "목", "금", "토", "일"];
const TODAY = 29; // 2026-06-29

// 이벤트 색(인라인): 완료=초록 / 진행중=파랑 / 지연=빨강
const EV_STYLE: Record<Ev[0], React.CSSProperties> = {
  done: { background: "#dcfce7", color: "#15803d" },
  prog: { background: "#dbeafe", color: "#1d4ed8" },
  late: { background: "#fee2e2", color: "#b91c1c" },
};

export default function CalendarPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>캘린더</h1>
          <div className="sub">월별 업무 진행 현황 &amp; 프로젝트 타임라인</div>
        </div>
      </div>

      <div className="content">
        <div className="cal-head">
          <div className="cal-nav">
            <button>◀</button>
            <button>▶</button>
          </div>
          <div className="cal-month">2026년 6월</div>
          <div style={{ marginLeft: "auto" }} className="search">
            🔍<input placeholder="이전 태스크 검색 (담당자·상태·기간)" style={{ width: 240 }} />
          </div>
        </div>

        <div className="cal-grid">
          {DOWS.map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
          {/* 2026-06-01 = 월요일 → 앞 빈칸 없음 */}
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <div key={d} className={`cal-cell${d === TODAY ? " today" : ""}`}>
              <div className="cal-num">{d}</div>
              {(EVENTS[d] || []).map((e, idx) => (
                <div key={idx} className="cal-ev" style={EV_STYLE[e[0]]}>{e[1]}</div>
              ))}
            </div>
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={`m${i}`} className="cal-cell muted" />
          ))}
        </div>

        <div className="card gantt">
          <div className="sec-title mb16"><span className="em">📊</span> 프로젝트 타임라인</div>
          <div className="gantt-row">
            <div className="nm">웹 리뉴얼</div>
            <div className="gantt-track">
              <div className="gantt-bar" style={{ left: 0, width: "62%", background: "#4f46e5" }}>6/1 – 6/20</div>
            </div>
          </div>
          <div className="gantt-row">
            <div className="nm">앱 v2.0</div>
            <div className="gantt-track">
              <div className="gantt-bar" style={{ left: "13%", width: "80%", background: "#0f766e" }}>6/5 – 6/30</div>
            </div>
          </div>
          <div className="gantt-row">
            <div className="nm" style={{ color: "var(--text-3)" }}>레거시 마이그레이션</div>
            <div className="gantt-track">
              <div className="gantt-bar" style={{ left: 0, width: "38%", background: "#9ca3af" }}>5/1 – 5/25 ✓</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
