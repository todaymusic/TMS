"use client";

import { STATUS_LABEL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <>
      <div className="topbar">
        <div>
          <h1>설정</h1>
          <div className="sub">내 계정 · 워크스페이스</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ padding: 22, maxWidth: 460 }}>
          <div className="sec-title mb16">
            <span className="em">👤</span> 내 계정
          </div>
          {user ? (
            <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" style={{ background: user.avatarColor, width: 40, height: 40 }}>
                  {user.name.slice(0, 1)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{user.name}</div>
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>{user.email}</div>
                </div>
              </div>
              <div>부서: {user.dept ?? "—"}</div>
              <div>직책: {user.role ?? "—"}</div>
              <div>상태: {STATUS_LABEL[user.status]}</div>
              <button
                className="btn"
                style={{ marginTop: 10, color: "#dc2626" }}
                onClick={logout}
              >
                🚪 로그아웃
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>로그인 정보를 불러오는 중…</div>
          )}
        </div>
        <div className="card" style={{ padding: 22, maxWidth: 460, marginTop: 16 }}>
          <div className="sec-title">
            <span className="em">⚙️</span> 워크스페이스 설정
          </div>
          <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 8 }}>
            비밀번호 변경·알림 채널 등은 준비 중입니다.
          </div>
        </div>
      </div>
    </>
  );
}
