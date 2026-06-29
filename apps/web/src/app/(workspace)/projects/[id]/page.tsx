import Link from "next/link";

// 프로젝트 상세 — Phase 1 쉘(목업: 웹 리뉴얼). 추후 id로 실제 데이터 로드.
export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params; // Next 16: params는 Promise

  return (
    <>
      <div className="topbar">
        <div>
          <h1>프로젝트</h1>
          <div className="sub">웹 리뉴얼</div>
        </div>
      </div>

      <div className="content">
        <Link href="/projects" className="detail-back">← 프로젝트 목록으로</Link>

        {/* 고정 상단 */}
        <div className="card pinned">
          <div className="pinned-top">
            <div>
              <h2>웹 리뉴얼</h2>
              <div className="overview">코퍼레이트 웹사이트 전면 개편 — 브랜드 리프레시 및 반응형 전환</div>
            </div>
            <span className="pill indigo" style={{ marginLeft: "auto" }}>📌 고정</span>
          </div>
          <div className="pinned-grid">
            <div><div className="field-lbl">기간</div><div className="field-val">2026.06.01 – 06.20</div></div>
            <div>
              <div className="field-lbl">진행률</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="prog" style={{ flex: 1 }}><i style={{ width: "62%" }} /></div>
                <b style={{ fontSize: 13 }}>62%</b>
              </div>
            </div>
            <div>
              <div className="field-lbl">담당자 맵핑</div>
              <div className="role-map">
                <span>리드 · <b>김서연</b></span>
                <span>디자인 · <b>김서연</b></span>
                <span>개발 · <b>이준호</b></span>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="field-lbl">참여자</div>
              <div className="field-val" style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13 }}>박민지 · 정하늘</div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="field-lbl">업무 설명</div>
              <div className="field-val" style={{ fontWeight: 400, color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>
                메인·서브 페이지 14종 리디자인, 디자인 시스템 토큰화, Next.js 마이그레이션. 6/20 내부 QA 후 7월 초 배포 목표.
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="field-lbl">관련 데이터</div>
              <div className="links">
                <span className="link-chip">🎨 Figma 디자인</span>
                <span className="link-chip">📄 기획서.pdf</span>
                <span className="link-chip">🔌 API 명세서</span>
              </div>
            </div>
          </div>
        </div>

        {/* 상단 2단: AI 요약 + 커뮤니케이션 */}
        <div className="detail-cols">
          <div className="card ai-card" style={{ marginBottom: 0 }}>
            <div className="ai-head">
              <span className="pill teal">🤖 AI 소통 요약</span>
              <span className="upd">마지막 갱신 · 오늘 09:00</span>
              <button className="btn sm" style={{ marginLeft: 8 }}>지금 요약</button>
            </div>
            <div className="ai-block">
              <div className="h">1) 핵심 결정사항</div>
              <ul>
                <li>메인 히어로는 풀스크린 영상 대신 인터랙티브 일러스트로 확정</li>
                <li>디자인 토큰은 Tailwind config로 단일화</li>
              </ul>
            </div>
            <div className="ai-block">
              <div className="h">2) 진행 상황</div>
              <ul><li>메인·소개 페이지 디자인 완료, 개발 착수 (62%)</li></ul>
            </div>
            <div className="ai-block">
              <div className="h">3) 미결 이슈 / 액션아이템</div>
              <ul>
                <li>모바일 GNB 동작 방식 미정 → <b>이준호</b> 6/27까지 시안</li>
                <li>API 응답 스펙 확정 필요 → 백엔드팀 확인 대기</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="panel-head"><div className="sec-title"><span className="em">💬</span> 커뮤니케이션</div><span className="count">메시지 24</span></div>
            <div className="thread">
              <div className="msg">
                <div className="avatar" style={{ background: "#4f46e5" }}>김</div>
                <div className="msg-body">
                  <div className="msg-top"><span className="msg-name">김서연</span><span className="msg-time">오늘 09:42</span></div>
                  <div className="msg-text">메인 히어로 일러스트 시안 올렸어요. <span className="mention">@이준호</span> 개발 들어가기 전에 인터랙션 봐주세요!</div>
                  <div className="reactions"><span className="rx on">👍 2</span><span className="rx">🎉 1</span></div>
                </div>
              </div>
              <div className="msg">
                <div className="avatar" style={{ background: "#0f766e" }}>이</div>
                <div className="msg-body">
                  <div className="msg-top"><span className="msg-name">이준호</span><span className="msg-time">오늘 10:15</span></div>
                  <div className="msg-text">좋아요. 스크롤 트리거는 이 패턴으로 갈게요.</div>
                  <div className="code-blk">{`const reveal = useScrollReveal({\n  threshold: 0.2,\n  once: true,\n});`}</div>
                </div>
              </div>
              <div className="msg">
                <div className="avatar" style={{ background: "#4f46e5" }}>김</div>
                <div className="msg-body">
                  <div className="msg-top"><span className="msg-name">김서연</span><span className="msg-time">오늘 10:31</span></div>
                  <div className="msg-text">완벽 👍 모바일 GNB만 내일 시안 같이 정하시죠.</div>
                </div>
              </div>
            </div>
            <div className="composer">
              <input className="inp" placeholder="메시지 입력…  @멘션 · 파일첨부 · 코드블록" />
              <button className="btn primary sm">전송</button>
            </div>
          </div>
        </div>

        {/* 태스크 보드 — 전체 너비(잘림 방지) */}
        <div className="card" style={{ padding: "16px 18px", marginTop: 18 }}>
          <div className="sec-title mb16"><span className="em">📋</span> 태스크 보드</div>
          <div className="kanban">
            <div className="kcol">
              <div className="kcol-head">📥 할일 <span className="n">2</span></div>
              <div className="kcard"><div className="kt">모바일 GNB 시안</div><div className="kf"><span className="pri h">높음</span><span className="dd">6/27</span></div></div>
              <div className="kcard"><div className="kt">푸터 리디자인</div><div className="kf"><span className="pri l">낮음</span><span className="dd">6/30</span></div></div>
            </div>
            <div className="kcol">
              <div className="kcol-head">🔄 진행중 <span className="n">1</span></div>
              <div className="kcard"><div className="kt">메인 히어로 개발</div><div className="kf"><span className="pri u">긴급</span><span className="dd">6/26</span></div></div>
            </div>
            <div className="kcol">
              <div className="kcol-head">👀 검토중 <span className="n">1</span></div>
              <div className="kcard"><div className="kt">소개 페이지 QA</div><div className="kf"><span className="pri m">보통</span><span className="dd">6/28</span></div></div>
            </div>
            <div className="kcol">
              <div className="kcol-head">✅ 완료 <span className="n">1</span></div>
              <div className="kcard"><div className="kt">디자인 토큰 정리</div><div className="kf"><span className="pri m">보통</span><span className="dd">6/24</span></div></div>
            </div>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>↔ 카드를 드래그해 상태를 변경할 수 있어요</div>
        </div>
      </div>
    </>
  );
}
