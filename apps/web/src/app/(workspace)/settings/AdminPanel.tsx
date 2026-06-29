"use client";

import { useEffect, useState } from "react";
import { api, type Leave, type LeaveType, type User } from "@/lib/api";

const LEAVE_LABEL: Record<LeaveType, string> = {
  annual: "연차",
  half: "반차",
  sick: "병가",
  etc: "기타",
};
const STATUS_KO = { requested: "신청됨", approved: "승인", rejected: "반려" } as const;

type LeaveWithUser = Leave & { user: { id: string; name: string; avatarColor: string } };

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [leaves, setLeaves] = useState<LeaveWithUser[]>([]);
  // 멤버 편집 로컬 상태 {userId: {dept, role}}
  const [edits, setEdits] = useState<Record<string, { dept: string; role: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [u, l] = await Promise.all([
      api.get<User[]>("/users"),
      api.get<LeaveWithUser[]>("/leaves"),
    ]);
    setUsers(u);
    setLeaves(l);
    setEdits(
      Object.fromEntries(u.map((x) => [x.id, { dept: x.dept ?? "", role: x.role ?? "" }])),
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
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* 전체 휴가 관리 */}
      <div className="card" style={{ padding: 22 }}>
        <div className="sec-title mb16">
          <span className="em">🗂️</span> 전 멤버 휴가 (관리자)
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {leaves.length === 0 && (
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>신청된 휴가가 없습니다.</div>
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
              <div className="avatar" style={{ background: lv.user.avatarColor, width: 26, height: 26, fontSize: 12 }}>
                {lv.user.name.slice(0, 1)}
              </div>
              <span style={{ fontWeight: 600, minWidth: 48 }}>{lv.user.name}</span>
              <span className="pill gray">{LEAVE_LABEL[lv.type]}</span>
              <span>
                {fmt(lv.startDate)} – {fmt(lv.endDate)}
              </span>
              {lv.reason && <span style={{ color: "var(--text-3)" }}>· {lv.reason}</span>}
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
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 멤버 직책/담당업무 수정 */}
      <div className="card" style={{ padding: 22 }}>
        <div className="sec-title mb16">
          <span className="em">🧑‍💼</span> 멤버 관리 (직책 · 담당업무)
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className="avatar" style={{ background: u.avatarColor, width: 28, height: 28, fontSize: 12 }}>
                {u.name.slice(0, 1)}
              </div>
              <span style={{ fontWeight: 600, minWidth: 48, fontSize: 13 }}>
                {u.name}
                {u.isAdmin && <span className="pill teal" style={{ marginLeft: 4 }}>관리자</span>}
              </span>
              <input
                className="inp"
                placeholder="담당업무(부서)"
                value={edits[u.id]?.dept ?? ""}
                onChange={(e) => setEdits((c) => ({ ...c, [u.id]: { ...c[u.id], dept: e.target.value } }))}
                style={{ flex: 1, minWidth: 120 }}
              />
              <input
                className="inp"
                placeholder="직책"
                value={edits[u.id]?.role ?? ""}
                onChange={(e) => setEdits((c) => ({ ...c, [u.id]: { ...c[u.id], role: e.target.value } }))}
                style={{ flex: 1, minWidth: 100 }}
              />
              <button className="btn sm" onClick={() => saveMember(u.id)} disabled={busy === u.id}>
                저장
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
