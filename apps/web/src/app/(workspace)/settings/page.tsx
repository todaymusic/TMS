"use client";

import { useEffect, useState } from "react";
import { api, STATUS_LABEL, type Leave, type LeaveType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AdminPanel from "./AdminPanel";

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half: "반차",
  quarter: "반반차",
  sick: "병가",
  etc: "기타",
};
const STATUS_KO = {
  requested: "신청됨",
  approved: "승인",
  rejected: "반려",
} as const;

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();

  // 비밀번호 변경
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [nw2, setNw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // 휴가
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [lvType, setLvType] = useState<LeaveType>("annual");
  const [lvStart, setLvStart] = useState("");
  const [lvEnd, setLvEnd] = useState("");
  const [lvReason, setLvReason] = useState("");
  const [lvMsg, setLvMsg] = useState<string | null>(null);
  const [lvBusy, setLvBusy] = useState(false);

  async function loadLeaves() {
    if (!user) return;
    try {
      const l = await api.get<Leave[]>(`/leaves?userId=${user.id}`);
      setLeaves(l);
    } catch {
      /* noop */
    }
  }
  useEffect(() => {
    void loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function changePassword() {
    setPwMsg(null);
    if (nw.length < 4) {
      setPwMsg("새 비밀번호는 4자 이상이어야 합니다");
      return;
    }
    if (nw !== nw2) {
      setPwMsg("새 비밀번호 확인이 일치하지 않습니다");
      return;
    }
    setPwBusy(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: cur,
        newPassword: nw,
      });
      setPwMsg("✅ 비밀번호가 변경되었습니다");
      setCur("");
      setNw("");
      setNw2("");
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "변경 실패");
    } finally {
      setPwBusy(false);
    }
  }

  async function requestLeave() {
    setLvMsg(null);
    if (!user) return;
    if (!lvStart || !lvEnd) {
      setLvMsg("시작일과 종료일을 입력하세요");
      return;
    }
    setLvBusy(true);
    try {
      await api.post("/leaves", {
        userId: user.id,
        type: lvType,
        startDate: lvStart,
        endDate: lvEnd,
        reason: lvReason.trim() || undefined,
      });
      setLvMsg("✅ 휴가를 신청했습니다");
      setLvStart("");
      setLvEnd("");
      setLvReason("");
      await loadLeaves();
    } catch (e) {
      setLvMsg(e instanceof Error ? e.message : "신청 실패");
    } finally {
      setLvBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>설정</h1>
          <div className="sub">내 계정 · 비밀번호 · 휴가</div>
        </div>
      </div>
      <div className="content" style={{ display: "grid", gap: 16 }}>
        {user?.isAdmin && (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="pill teal" style={{ width: "fit-content" }}>
              👑 관리자 모드
            </div>
            <AdminPanel />
          </div>
        )}

        {/* 내 휴가 (잔여 + 신청 + 목록) */}
        <div className="card" style={{ padding: 22, maxWidth: 600 }}>
          <div className="sec-title mb16" style={{ display: "flex", alignItems: "center" }}>
            <span className="em">🌴</span> 내 휴가
            <span className="pill teal" style={{ marginLeft: "auto", fontSize: 13 }}>
              남은 연차 {user?.leaveBalance ?? 0}일
            </span>
          </div>

          <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>종류</label>
              <select className="inp" value={lvType} onChange={(e) => setLvType(e.target.value as LeaveType)}>
                <option value="annual">연차 (−1)</option>
                <option value="half">반차 (−0.5)</option>
                <option value="quarter">반반차 (−0.25)</option>
                <option value="sick">병가</option>
                <option value="etc">기타</option>
              </select>
            </div>
            <div>
              <label>사유 (선택)</label>
              <input className="inp" value={lvReason} onChange={(e) => setLvReason(e.target.value)} placeholder="사유" />
            </div>
            <div>
              <label>시작일</label>
              <input className="inp" type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} />
            </div>
            <div>
              <label>종료일</label>
              <input className="inp" type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} />
            </div>
          </div>
          {lvMsg && (
            <div className="field-hint" style={{ color: lvMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
              {lvMsg}
            </div>
          )}
          <button className="btn primary" onClick={requestLeave} disabled={lvBusy}>
            {lvBusy ? "신청 중…" : "휴가 신청"}
          </button>
          <div className="hint" style={{ marginTop: 6 }}>
            관리자 승인 시 종류별로 잔여 연차에서 자동 차감됩니다.
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {leaves.length === 0 && (
              <div style={{ color: "var(--text-3)", fontSize: 13 }}>신청한 휴가가 없습니다.</div>
            )}
            {leaves.map((lv) => (
              <div
                key={lv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span className="pill gray">{LEAVE_LABEL[lv.type]}</span>
                <span>
                  {fmt(lv.startDate)} – {fmt(lv.endDate)}
                </span>
                {lv.reason && <span style={{ color: "var(--text-3)" }}>· {lv.reason}</span>}
                <span
                  className="pill"
                  style={{
                    marginLeft: "auto",
                    background:
                      lv.status === "approved" ? "#dcfce7" : lv.status === "rejected" ? "#fee2e2" : "#fef9c3",
                    color:
                      lv.status === "approved" ? "#15803d" : lv.status === "rejected" ? "#b91c1c" : "#a16207",
                  }}
                >
                  {STATUS_KO[lv.status]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 내 계정 */}
        <div className="card" style={{ padding: 22, maxWidth: 600 }}>
          <div className="sec-title mb16">
            <span className="em">👤</span> 내 계정
          </div>
          {user ? (
            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar" style={{ background: user.avatarColor, width: 40, height: 40 }}>
                  {user.name.slice(0, 1)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {user.name}{" "}
                    <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 12 }}>
                      {user.dept ?? ""} {user.role ?? ""}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>{user.email}</div>
                </div>
                <span className="pill gray" style={{ marginLeft: "auto" }}>
                  {STATUS_LABEL[user.status]}
                </span>
              </div>
              <button className="btn" style={{ marginTop: 6, color: "#dc2626", width: 120 }} onClick={logout}>
                🚪 로그아웃
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</div>
          )}
        </div>

        {/* 비밀번호 변경 */}
        <div className="card" style={{ padding: 22, maxWidth: 600 }}>
          <div className="sec-title mb16">
            <span className="em">🔒</span> 비밀번호 변경
          </div>
          <div className="assign-field">
            <label>현재 비밀번호</label>
            <input className="inp" type="password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="assign-field">
            <label>새 비밀번호</label>
            <input className="inp" type="password" value={nw} onChange={(e) => setNw(e.target.value)} />
          </div>
          <div className="assign-field">
            <label>새 비밀번호 확인</label>
            <input className="inp" type="password" value={nw2} onChange={(e) => setNw2(e.target.value)} />
          </div>
          {pwMsg && (
            <div className="field-hint" style={{ color: pwMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
              {pwMsg}
            </div>
          )}
          <button className="btn primary" onClick={changePassword} disabled={pwBusy}>
            {pwBusy ? "변경 중…" : "비밀번호 변경"}
          </button>
        </div>
      </div>
    </>
  );
}
