"use client";

import { useEffect, useState } from "react";
import { api, scopeUsers, type Leave, type LeaveType, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half: "반차",
  quarter: "반반차",
  sick: "병가",
  etc: "기타",
  business_trip: "출장",
};
const STATUS_KO = { requested: "신청됨", approved: "승인", rejected: "반려" } as const;

type LeaveWithUser = Leave & { user: { id: string; name: string; avatarColor: string } };
type Edit = { dept: string; role: string; bal: string; grant: string };

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function AdminPanel({ isMaster = false }: { isMaster?: boolean }) {
  const { viewApp, homeApp } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [leaves, setLeaves] = useState<LeaveWithUser[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // 계정 추가 폼(마승일 전용)
  const DEFAULT_PW = "tms2026!";
  const [nn, setNn] = useState(""); // 이름
  const [ne, setNe] = useState(""); // 이메일
  const [np, setNp] = useState(DEFAULT_PW); // 초기 비밀번호
  const [nDept, setNDept] = useState("");
  const [nRole, setNRole] = useState("");
  const [nAdmin, setNAdmin] = useState(false);
  const [accMsg, setAccMsg] = useState<string | null>(null);
  const [accBusy, setAccBusy] = useState(false);

  async function load() {
    const [u, l] = await Promise.all([
      api.get<User[]>("/users"),
      api.get<LeaveWithUser[]>("/leaves"),
    ]);
    setUsers(u);
    setLeaves(l);
    setEdits(
      Object.fromEntries(
        u.map((x) => [
          x.id,
          {
            dept: x.dept ?? "",
            role: x.role ?? "",
            bal: String(x.leaveBalance ?? 0),
            grant: String(x.monthlyLeaveGrant ?? 1),
          },
        ]),
      ),
    );
  }
  useEffect(() => {
    void load();
  }, []);

  async function saveMember(id: string) {
    setBusy(id);
    try {
      await api.patch(`/users/${id}`, {
        dept: edits[id]?.dept || undefined,
        role: edits[id]?.role || undefined,
        leaveBalance: Number(edits[id]?.bal ?? 0) || 0,
        // 월 적립(monthlyLeaveGrant)은 마승일 계정에서만 변경 가능 — 그 외엔 미전송(기존값 유지)
        ...(isMaster
          ? { monthlyLeaveGrant: Number(edits[id]?.grant ?? 1) || 0 }
          : {}),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function setLeaveStatus(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      await api.patch(`/leaves/${id}/status`, { status });
      await load(); // 승인 시 잔여 차감 → 멤버 목록도 갱신
    } finally {
      setBusy(null);
    }
  }
  // 취소 요청 승인(삭제+연차 복구) / 거절
  async function confirmCancel(id: string) {
    setBusy(id);
    try {
      await api.del(`/leaves/${id}`);
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function denyCancel(id: string) {
    setBusy(id);
    try {
      await api.patch(`/leaves/${id}/deny-cancel`, {});
      await load();
    } finally {
      setBusy(null);
    }
  }

  // ── 계정 관리(마승일 전용) ──
  async function createAccount() {
    setAccMsg(null);
    if (!nn.trim() || !ne.trim()) {
      setAccMsg("이름과 이메일을 입력하세요");
      return;
    }
    setAccBusy(true);
    try {
      // 계정 소속 앱 = 현재 보기 앱(전체 보기면 이 웹의 홈앱). hello면 민트색 프로필
      const acctApp = viewApp === "all" ? homeApp : viewApp;
      await api.post("/users", {
        name: nn.trim(),
        email: ne.trim(),
        password: np || DEFAULT_PW,
        dept: nDept.trim() || undefined,
        role: nRole.trim() || undefined,
        isAdmin: nAdmin,
        app: acctApp,
        ...(acctApp === "hellotms" ? { avatarColor: "#14b8a6" } : {}),
      });
      setAccMsg(`✅ '${nn.trim()}' 계정 생성 (초기 비번: ${np || DEFAULT_PW})`);
      setNn("");
      setNe("");
      setNp(DEFAULT_PW);
      setNDept("");
      setNRole("");
      setNAdmin(false);
      await load();
    } catch (e) {
      setAccMsg(e instanceof Error ? e.message : "계정 생성 실패");
    } finally {
      setAccBusy(false);
    }
  }
  async function toggleDisabled(u: User) {
    setBusy(u.id);
    try {
      await api.patch(`/users/${u.id}`, { disabled: !u.disabled });
      await load();
    } finally {
      setBusy(null);
    }
  }
  async function resetPassword(u: User) {
    if (!window.confirm(`${u.name} 계정의 비밀번호를 '${DEFAULT_PW}'(으)로 초기화할까요?`)) return;
    setBusy(u.id);
    try {
      await api.patch(`/users/${u.id}`, { password: DEFAULT_PW });
      setAccMsg(`🔑 ${u.name} 비밀번호를 '${DEFAULT_PW}'(으)로 초기화했습니다`);
    } finally {
      setBusy(null);
    }
  }
  async function deleteAccount(u: User) {
    if (!window.confirm(`${u.name}(${u.email}) 계정을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(u.id);
    setAccMsg(null);
    try {
      await api.del(`/users/${u.id}`);
      setAccMsg(`🗑️ ${u.name} 계정을 삭제했습니다`);
      await load();
    } catch (e) {
      setAccMsg(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setBusy(null);
    }
  }

  // 현재 보기 앱(tms/hello)으로 계정·휴가 필터
  const scopedUsers = scopeUsers(users, viewApp);
  const scopedIds = new Set(scopedUsers.map((u) => u.id));

  // 최근 3개월(종료일 기준) + 취소요청은 항상 표시 — 보기 앱 소속 멤버만
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 92;
  const visibleLeaves = leaves.filter(
    (lv) =>
      scopedIds.has(lv.user.id) &&
      (lv.cancelRequested || new Date(lv.endDate).getTime() >= cutoff),
  );

  const upd = (id: string, patch: Partial<Edit>) =>
    setEdits((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: 16,
        alignItems: "start",
      }}
    >
      {/* 계정 관리 (마승일 전용) */}
      {isMaster && (
        <div className="card" style={{ padding: 22, gridColumn: "1 / -1" }}>
          <div className="sec-title mb16">
            <span className="em">🔐</span> 계정 관리 (마승일 전용) — 계정 생성 · 비활성화 · 비번 초기화 · 삭제
          </div>

          {/* 계정 추가 */}
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>➕ 계정 추가</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input className="inp" placeholder="이름" value={nn} onChange={(e) => setNn(e.target.value)} style={{ flex: "1 1 120px", padding: "6px 8px" }} />
              <input className="inp" placeholder="이메일" value={ne} onChange={(e) => setNe(e.target.value)} style={{ flex: "1 1 160px", padding: "6px 8px" }} />
              <input className="inp" placeholder="초기 비밀번호" value={np} onChange={(e) => setNp(e.target.value)} style={{ flex: "1 1 120px", padding: "6px 8px" }} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input className="inp" placeholder="부서(선택)" value={nDept} onChange={(e) => setNDept(e.target.value)} style={{ flex: "1 1 100px", padding: "6px 8px" }} />
              <input className="inp" placeholder="직책(선택)" value={nRole} onChange={(e) => setNRole(e.target.value)} style={{ flex: "1 1 100px", padding: "6px 8px" }} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={nAdmin} onChange={(e) => setNAdmin(e.target.checked)} /> 관리자
              </label>
              <button className="btn primary sm" onClick={createAccount} disabled={accBusy} style={{ padding: "6px 14px" }}>
                {accBusy ? "생성 중…" : "계정 추가"}
              </button>
            </div>
            {accMsg && (
              <div
                className="field-hint"
                style={{ color: /^[✅🔑🗑️]/.test(accMsg) ? "#16a34a" : "#dc2626" }}
              >
                {accMsg}
              </div>
            )}
            <div className="hint">
              새 계정은 위 초기 비밀번호로 로그인합니다. 활동 이력이 있는 계정은 삭제가 막히니(안전장치) <b>비활성화</b>로 로그인을 차단하세요.
            </div>
          </div>

          {/* 계정 목록 + 컨트롤 */}
          <div style={{ display: "grid", gap: 6 }}>
            {scopedUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  flexWrap: "wrap",
                  opacity: u.disabled ? 0.55 : 1,
                }}
              >
                <div className="avatar" style={{ background: u.avatarColor, width: 24, height: 24, fontSize: 11 }}>
                  {u.name.slice(0, 1)}
                </div>
                <span style={{ fontWeight: 600 }}>{u.name}</span>
                <span style={{ color: "var(--text-3)" }}>{u.email}</span>
                {u.isAdmin && <span className="pill teal">관리자</span>}
                {u.disabled && <span className="pill" style={{ background: "#fee2e2", color: "#b91c1c" }}>비활성</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn sm" onClick={() => toggleDisabled(u)} disabled={busy === u.id}>
                    {u.disabled ? "활성화" : "비활성화"}
                  </button>
                  <button className="btn sm" onClick={() => resetPassword(u)} disabled={busy === u.id}>
                    비번 초기화
                  </button>
                  <button className="btn sm" style={{ color: "#dc2626" }} onClick={() => deleteAccount(u)} disabled={busy === u.id}>
                    삭제
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 멤버 관리 */}
      <div className="card" style={{ padding: 22 }}>
        <div className="sec-title mb16">
          <span className="em">🧑‍💼</span> 멤버 관리 (직책 · 담당업무 · 연차잔여{isMaster ? " · 월적립" : ""})
        </div>
        {isMaster && (
          <div className="hint" style={{ marginBottom: 10 }}>
            칸 순서: 담당업무 · 직책 · <b>연차잔여</b> · <b style={{ color: "#15803d" }}>월적립(초록칸)</b>.
            월적립은 매월 1일 자동으로 잔여 연차에 더해집니다(0이면 적립 안 함). 이 칸은 마승일 계정에만 보입니다.
          </div>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          {scopedUsers.map((u) => (
            <div key={u.id} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="avatar" style={{ background: u.avatarColor, width: 26, height: 26, fontSize: 12 }}>
                  {u.name.slice(0, 1)}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</span>
                {u.isAdmin && <span className="pill teal">관리자</span>}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input
                  className="inp"
                  placeholder="담당업무"
                  value={edits[u.id]?.dept ?? ""}
                  onChange={(e) => upd(u.id, { dept: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: "6px 8px" }}
                />
                <input
                  className="inp"
                  placeholder="직책"
                  value={edits[u.id]?.role ?? ""}
                  onChange={(e) => upd(u.id, { role: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: "6px 8px" }}
                />
                <input
                  className="inp"
                  type="number"
                  step="0.25"
                  title="연차 잔여(일)"
                  value={edits[u.id]?.bal ?? "0"}
                  onChange={(e) => upd(u.id, { bal: e.target.value })}
                  style={{ width: 52, padding: "6px 6px", flexShrink: 0 }}
                />
                {isMaster && (
                  <input
                    className="inp"
                    type="number"
                    step="0.25"
                    min="0"
                    title="월 자동적립(일) — 매월 1일 자동 지급"
                    value={edits[u.id]?.grant ?? "1"}
                    onChange={(e) => upd(u.id, { grant: e.target.value })}
                    style={{ width: 52, padding: "6px 6px", flexShrink: 0, background: "#f0fdf4" }}
                  />
                )}
                <button
                  className="btn primary sm"
                  style={{ flexShrink: 0, padding: "6px 12px" }}
                  onClick={() => saveMember(u.id)}
                  disabled={busy === u.id}
                >
                  저장
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 전 멤버 휴가 */}
      <div className="card" style={{ padding: 22 }}>
        <div className="sec-title mb16">
          <span className="em">🗂️</span> 전 멤버 휴가 (승인/반려)
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {visibleLeaves.length === 0 && (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>최근 3개월 내 휴가가 없습니다.</div>
          )}
          {visibleLeaves.map((lv) => (
            <div
              key={lv.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 44 }}>{lv.user.name}</span>
              <span className="pill gray">{LEAVE_LABEL[lv.type]}</span>
              <span>
                {fmt(lv.startDate)}–{fmt(lv.endDate)}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  className="pill"
                  style={{
                    background:
                      lv.status === "approved" ? "#dcfce7" : lv.status === "rejected" ? "#fee2e2" : "#fef9c3",
                    color:
                      lv.status === "approved" ? "#15803d" : lv.status === "rejected" ? "#b91c1c" : "#a16207",
                  }}
                >
                  {STATUS_KO[lv.status]}
                </span>
                {lv.status === "requested" && (
                  <>
                    <button className="btn sm" onClick={() => setLeaveStatus(lv.id, "approved")} disabled={busy === lv.id}>
                      승인
                    </button>
                    <button className="btn sm" onClick={() => setLeaveStatus(lv.id, "rejected")} disabled={busy === lv.id}>
                      반려
                    </button>
                  </>
                )}
                {lv.cancelRequested && (
                  <>
                    <span className="pill" style={{ background: "#fef9c3", color: "#a16207" }}>
                      취소요청
                    </span>
                    <button className="btn sm" onClick={() => confirmCancel(lv.id)} disabled={busy === lv.id}>
                      취소 승인
                    </button>
                    <button className="btn sm" onClick={() => denyCancel(lv.id)} disabled={busy === lv.id}>
                      거절
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          승인 시 연차 −1 / 반차 −0.5 / 반반차 −0.25 자동 차감됩니다.
        </div>
      </div>
    </div>
  );
}
