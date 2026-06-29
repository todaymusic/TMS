"use client";

import { useState } from "react";

type ChkState = "todo" | "doing" | "done";
type ChkItem = { id: number; title: string; output: string; state: ChkState; range?: string };

const INITIAL: ChkItem[] = [
  { id: 1, title: "메인 히어로 개발", output: "📊🎥", state: "todo" },
  { id: 2, title: "프론트 리팩토링", output: "—", state: "doing", range: "10:00~" },
  { id: 3, title: "디자인 토큰 정리", output: "📊", state: "done", range: "09:00~09:40" },
];

export default function ActivityPage() {
  const [items, setItems] = useState<ChkItem[]>(INITIAL);

  const start = (id: number) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, state: "doing", range: "지금~" } : it)));
  const finish = (id: number) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, state: "done", range: (it.range || "") + " 종료" } : it)));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>내 활동</h1>
          <div className="sub">오늘 할일 · 멘션 피드 · 스케줄</div>
        </div>
      </div>

      <div className="content">
        {/* 최상단: 오늘 할일 체크리스트 */}
        <div className="card mb16">
          <div className="panel-head"><div className="sec-title"><span className="em">✅</span> 오늘 할일 체크리스트</div></div>
          <div className="chklist">
            {items.map((it) => (
              <div key={it.id} className={`chk-item ${it.state}`}>
                <input
                  type="checkbox"
                  checked={it.state !== "todo"}
                  readOnly
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span className={`ct${it.state === "done" ? " s" : ""}`}>{it.title}</span>
                <span className="meta">{it.output}</span>
                {it.state === "todo" && <button className="btn sm" onClick={() => start(it.id)}>시작</button>}
                {it.state === "doing" && (
                  <>
                    <span className="meta">⏱ {it.range}</span>
                    <button className="btn sm" onClick={() => finish(it.id)}>종료</button>
                  </>
                )}
                {it.state === "done" && <span className="meta">{it.range} ✓</span>}
              </div>
            ))}
          </div>
          <div className="hint" style={{ padding: "0 18px 16px" }}>체크(시작) → 대시보드에 진행중 표시 · 종료 → 산출물 입력 (백엔드 연결 후)</div>
        </div>

        <div className="act-cols">
          {/* 좌: 피드 */}
          <div className="card">
            <div className="panel-head"><div className="sec-title"><span className="em">📨</span> 멘션 &amp; 소통 피드</div><span className="count">새 알림 3</span></div>
            <div className="feed-group">오늘</div>
            <div className="feed-item unread">
              <div className="feed-ic mention">@</div>
              <div><div className="feed-txt"><b>김서연</b>님이 회원님을 멘션했어요<br /><span style={{ color: "var(--text-2)" }}>“@이준호 인터랙션 한 번만 봐주세요”</span></div><div className="feed-time">웹 리뉴얼 · 5분 전</div></div>
            </div>
            <div className="feed-item unread">
              <div className="feed-ic task">📋</div>
              <div><div className="feed-txt">새 태스크가 부여됐어요 — <b>모바일 GNB 시안</b></div><div className="feed-time">웹 리뉴얼 · 1시간 전</div></div>
            </div>
            <div className="feed-item unread">
              <div className="feed-ic sys">⚠️</div>
              <div><div className="feed-txt"><b>메인 히어로 개발</b> 마감이 오늘이에요</div><div className="feed-time">시스템 · 2시간 전</div></div>
            </div>
            <div className="feed-group">어제</div>
            <div className="feed-item">
              <div className="feed-ic task">✅</div>
              <div><div className="feed-txt"><b>디자인 토큰 정리</b> 태스크가 완료 처리됐어요</div><div className="feed-time">웹 리뉴얼 · 어제 17:20</div></div>
            </div>
            <div className="feed-item">
              <div className="feed-ic mention">@</div>
              <div><div className="feed-txt"><b>박민지</b>님이 앱 v2.0 스레드에서 회원님을 멘션했어요</div><div className="feed-time">앱 v2.0 · 어제 14:05</div></div>
            </div>
          </div>

          {/* 우: 타임라인 + 통계 */}
          <div style={{ display: "grid", gap: 18 }}>
            <div className="card">
              <div className="panel-head"><div className="sec-title"><span className="em">📅</span> 내 스케줄 — 오늘</div></div>
              <div className="timeline">
                <div className="tl-row"><div className="tl-time">09:00</div><div className="tl-track"><div className="tl-block alt"><div className="bt">스탠드업 미팅</div><div className="bs">09:00 – 09:30</div></div></div></div>
                <div className="tl-row"><div className="tl-time">10:00</div><div className="tl-track"><div className="tl-block"><div className="bt">프론트 리팩토링</div><div className="bs">10:00 – 12:00</div></div></div></div>
                <div className="tl-row"><div className="tl-time">12:00</div><div className="tl-track"><div className="tl-block lunch"><div className="bt">점심</div><div className="bs">12:00 – 13:00</div></div></div></div>
                <div className="tl-row"><div className="tl-time">14:00</div><div className="tl-track"><div className="tl-block alt"><div className="bt">코드 리뷰</div><div className="bs">14:00 – 15:00</div></div></div></div>
                <div className="tl-row"><div className="tl-time">16:00</div><div className="tl-track"><div className="tl-block"><div className="bt">API 문서 작성</div><div className="bs">16:00 – 18:00</div></div></div></div>
              </div>
              <div className="hint" style={{ padding: "0 18px 16px" }}>↕ 블록을 드래그해 시간을 조정할 수 있어요</div>
            </div>

            <div className="card">
              <div className="panel-head"><div className="sec-title"><span className="em">📊</span> 이번 주 통계</div></div>
              <div className="stats-row">
                <div className="stat"><div className="num done">8</div><div className="lb">완료</div></div>
                <div className="stat"><div className="num prog">3</div><div className="lb">진행중</div></div>
                <div className="stat"><div className="num wait">2</div><div className="lb">대기</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
