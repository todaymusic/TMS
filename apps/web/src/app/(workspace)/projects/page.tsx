import Link from "next/link";

export default function ProjectsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">활성 프로젝트 2 · 아카이브 1</div>
        </div>
      </div>

      <div className="content">
        <div className="proj-grid">
          <Link href="/projects/web-renewal" className="card proj-card">
            <div className="top">
              <span className="dot on" />
              <h3>웹 리뉴얼</h3>
              <span className="pill indigo" style={{ marginLeft: "auto" }}>진행중</span>
            </div>
            <div className="meta">2026.06.01 – 06.20 · 마감 D-3</div>
            <div className="prog mb16"><i style={{ width: "62%" }} /></div>
            <div className="proj-mem">
              <div className="stack">
                <div className="avatar" style={{ background: "#4f46e5" }}>김</div>
                <div className="avatar" style={{ background: "#0f766e" }}>이</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>김서연 · 이준호</span>
            </div>
          </Link>

          <Link href="/projects/app-v2" className="card proj-card">
            <div className="top">
              <span className="dot on" />
              <h3>앱 v2.0</h3>
              <span className="pill indigo" style={{ marginLeft: "auto" }}>진행중</span>
            </div>
            <div className="meta">2026.06.05 – 06.30 · 마감 D-1</div>
            <div className="prog teal mb16"><i style={{ width: "45%" }} /></div>
            <div className="proj-mem">
              <div className="stack">
                <div className="avatar" style={{ background: "#db2777" }}>박</div>
                <div className="avatar" style={{ background: "#ea580c" }}>최</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>박민지 · 최우진</span>
            </div>
          </Link>

          <div className="card proj-card new-proj">＋ 새 프로젝트</div>
        </div>

        <div className="archive-sec">
          <div className="sec-title mb16"><span className="em">📦</span> 아카이브</div>
          <div className="archive-bar">
            <span style={{ fontSize: 14 }}>📦</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>레거시 마이그레이션</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>2026.05.01 – 05.25 · 완료</div>
            </div>
            <span className="pill gray">읽기 전용</span>
            <button className="btn sm" style={{ marginLeft: "auto" }}>PDF 리포트</button>
          </div>
        </div>
      </div>
    </>
  );
}
