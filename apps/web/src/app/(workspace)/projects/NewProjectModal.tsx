"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";

const ROLES: { key: string; label: string }[] = [
  { key: "lead", label: "리드" },
  { key: "design", label: "디자인" },
  { key: "dev", label: "개발" },
  { key: "etc", label: "기타" },
];

type Owner = { userId: string; role: string };

export default function NewProjectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  const [name, setName] = useState("");
  const [overview, setOverview] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && users.length === 0) {
      api.get<User[]>("/users").then(setUsers).catch(() => {});
    }
  }, [open, users.length]);

  function reset() {
    setName("");
    setOverview("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setOwners([]);
    setParticipants([]);
    setErr(null);
  }

  function toggleOwner(userId: string) {
    setOwners((cur) =>
      cur.some((o) => o.userId === userId)
        ? cur.filter((o) => o.userId !== userId)
        : [...cur, { userId, role: "etc" }],
    );
    // 담당자로 추가하면 참여자에서는 제거
    setParticipants((cur) => cur.filter((id) => id !== userId));
  }
  function setOwnerRole(userId: string, role: string) {
    setOwners((cur) => cur.map((o) => (o.userId === userId ? { ...o, role } : o)));
  }
  function toggleParticipant(userId: string) {
    if (owners.some((o) => o.userId === userId)) return; // 담당자는 참여자 불가
    setParticipants((cur) =>
      cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId],
    );
  }

  async function submit() {
    if (!name.trim()) {
      setErr("프로젝트 이름을 입력하세요");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const proj = await api.post<{ id: string }>("/projects", {
        name: name.trim(),
        overview: overview.trim() || undefined,
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      for (const o of owners) {
        await api.post(`/projects/${proj.id}/owners`, {
          userId: o.userId,
          role: o.role,
        });
      }
      for (const uid of participants) {
        await api.post(`/projects/${proj.id}/participants`, { userId: uid });
      }
      setOpen(false);
      reset();
      router.push(`/projects/${proj.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="card proj-card new-proj"
        onClick={() => setOpen(true)}
        style={{ cursor: "pointer" }}
      >
        ＋ 새 프로젝트
      </div>

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
            style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", padding: 22 }}
          >
            <div className="panel-head">
              <div className="sec-title">
                <span className="em">📁</span> 새 프로젝트
              </div>
            </div>

            <div className="assign-field">
              <label>프로젝트 이름 *</label>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 2026 브랜드 리뉴얼 캠페인"
              />
            </div>

            <div className="assign-field">
              <label>한 줄 개요</label>
              <input
                className="inp"
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="프로젝트를 한 줄로"
              />
            </div>

            <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label>시작일</label>
                <input className="inp" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label>종료일</label>
                <input className="inp" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="assign-field">
              <label>담당자 (역할별 책임자)</label>
              <div className="chips">
                {users.map((u) => {
                  const on = owners.some((o) => o.userId === u.id);
                  return (
                    <span
                      key={u.id}
                      className={`chip${on ? " on" : ""}`}
                      onClick={() => toggleOwner(u.id)}
                    >
                      {u.name}
                    </span>
                  );
                })}
              </div>
              {owners.length > 0 && (
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {owners.map((o) => {
                    const u = users.find((x) => x.id === o.userId);
                    return (
                      <div key={o.userId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, minWidth: 60 }}>{u?.name}</span>
                        <select
                          className="inp"
                          value={o.role}
                          onChange={(e) => setOwnerRole(o.userId, e.target.value)}
                          style={{ flex: 1 }}
                        >
                          {ROLES.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="assign-field">
              <label>참여자 (협업 멤버)</label>
              <div className="chips">
                {users
                  .filter((u) => !owners.some((o) => o.userId === u.id))
                  .map((u) => (
                    <span
                      key={u.id}
                      className={`chip${participants.includes(u.id) ? " on" : ""}`}
                      onClick={() => toggleParticipant(u.id)}
                    >
                      {u.name}
                    </span>
                  ))}
              </div>
            </div>

            <div className="assign-field">
              <label>업무 설명</label>
              <textarea
                className="inp"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트 개요·목표"
              />
            </div>

            {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => !busy && setOpen(false)}>
                취소
              </button>
              <button className="btn primary" style={{ flex: 2 }} onClick={submit} disabled={busy}>
                {busy ? "생성 중…" : "프로젝트 생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
