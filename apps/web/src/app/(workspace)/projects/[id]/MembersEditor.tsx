"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, scopeUsers, type Member, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROLES: { key: string; label: string }[] = [
  { key: "lead", label: "리드" },
  { key: "design", label: "디자인" },
  { key: "dev", label: "개발" },
  { key: "etc", label: "기타" },
];
export default function MembersEditor({
  projectId,
  owners,
  participants,
}: {
  projectId: string;
  owners: Member[];
  participants: Member[];
}) {
  const router = useRouter();
  const { viewApp } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && users.length === 0) {
      api.get<User[]>("/users").then((u) => setUsers(scopeUsers(u, viewApp))).catch(() => {});
    }
  }, [open, users.length]);

  const ownerIds = new Set(owners.map((o) => o.userId));
  const partIds = new Set(participants.map((p) => p.userId));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const addOwner = (userId: string) =>
    run(() => api.post(`/projects/${projectId}/owners`, { userId, role: "etc" }));
  const setRole = (userId: string, role: string) =>
    run(() => api.post(`/projects/${projectId}/owners`, { userId, role }));
  const delOwner = (userId: string) =>
    run(() => api.del(`/projects/${projectId}/owners/${userId}`));
  const addPart = (userId: string) =>
    run(() => api.post(`/projects/${projectId}/participants`, { userId }));
  const delPart = (userId: string) =>
    run(() => api.del(`/projects/${projectId}/participants/${userId}`));

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        멤버 관리
      </button>

      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto", padding: 22 }}
          >
            <div className="panel-head">
              <div className="sec-title">
                <span className="em">👥</span> 멤버 관리
              </div>
              <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>

            {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}

            {/* 담당자 */}
            <div className="assign-field">
              <label>담당자 (역할별 책임자)</label>
              <div style={{ display: "grid", gap: 6 }}>
                {owners.length === 0 && (
                  <span style={{ color: "var(--text-3)", fontSize: 13 }}>없음</span>
                )}
                {owners.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, minWidth: 60 }}>{o.user.name}</span>
                    <select
                      className="inp"
                      value={o.role ?? "etc"}
                      onChange={(e) => setRole(o.userId, e.target.value)}
                      disabled={busy}
                      style={{ flex: 1 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn sm" onClick={() => delOwner(o.userId)} disabled={busy}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {users
                  .filter((u) => !ownerIds.has(u.id))
                  .map((u) => (
                    <span key={u.id} className="chip" onClick={() => !busy && addOwner(u.id)}>
                      + {u.name}
                    </span>
                  ))}
              </div>
            </div>

            {/* 참여자 */}
            <div className="assign-field">
              <label>참여자 (협업 멤버)</label>
              <div className="chips">
                {participants.length === 0 && (
                  <span style={{ color: "var(--text-3)", fontSize: 13 }}>없음</span>
                )}
                {participants.map((p) => (
                  <span key={p.id} className="chip on" onClick={() => !busy && delPart(p.userId)}>
                    {p.user.name} ✕
                  </span>
                ))}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {users
                  .filter((u) => !ownerIds.has(u.id) && !partIds.has(u.id))
                  .map((u) => (
                    <span key={u.id} className="chip" onClick={() => !busy && addPart(u.id)}>
                      + {u.name}
                    </span>
                  ))}
              </div>
            </div>

            <div className="hint">역할은 드롭다운으로, 칩 클릭으로 추가/제거됩니다.</div>
          </div>
        </div>
      )}
    </>
  );
}
