import Link from "next/link";

// 공용 업무 링크 — 여기에서 추가/수정하세요.
// (나중에 화면에서 편집하려면 서버 연동(B안)으로 이 목록을 API로 교체)
const SHARED_LINKS: { label: string; url: string; emoji?: string; desc?: string }[] = [
  {
    label: "오늘은뮤직 본사 계정정보",
    url: "https://docs.google.com/spreadsheets/d/1MIsOG9kN28o7G4hOwVilUFqSidXkmtee94NjbVvYS0E/edit?gid=0#gid=0",
    emoji: "🔑",
    desc: "본사 계정 정보 시트",
  },
  { label: "솔루션", url: "https://todaymusic.up.railway.app/", emoji: "🎵", desc: "todaymusic 솔루션" },
  { label: "질문박스", url: "https://unique-stardust-fab6e4.netlify.app/", emoji: "📮", desc: "질문박스" },
  { label: "HTML 페이지화 사이트", url: "https://www.netlify.com/", emoji: "🌐", desc: "Netlify" },
];

export default function LinksPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>🔗 링크</h1>
          <div className="sub">업무에 필요한 공용 링크 모음</div>
        </div>
        <div className="topbar-right">
          <Link href="/dashboard" className="btn sm">← 대시보드</Link>
        </div>
      </div>

      <div className="content">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {SHARED_LINKS.map((l) => (
            <a
              key={l.url + l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 18px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{l.emoji ?? "🔗"}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 15 }}>{l.label}</b>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-3)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {l.desc ?? l.url}
                </div>
              </span>
              <span style={{ color: "var(--text-3)", fontSize: 15 }}>↗</span>
            </a>
          ))}
        </div>

        <div className="field-hint" style={{ marginTop: 18 }}>
          ※ 현재 링크는 코드에서 관리됩니다. 화면에서 직접 추가·수정이 필요하면 서버 연동으로 업그레이드하세요.
        </div>
      </div>
    </>
  );
}
