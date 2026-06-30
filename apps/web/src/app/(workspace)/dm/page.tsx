"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  type ChatChannel,
  type ChatMessage,
  type User,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

function channelTitle(ch: ChatChannel, meId?: string) {
  if (ch.type === "broadcast") return "📢 전체 공지";
  if (ch.type === "group") return ch.name ?? "그룹";
  const other = ch.members.find((m) => m.id !== meId);
  return other?.name ?? "대화";
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function DmPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // 그룹 만들기 모달
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  async function loadChannels() {
    if (!me) return;
    const c = await api.get<ChatChannel[]>(`/chat/channels?userId=${me.id}`);
    setChannels(c);
  }
  useEffect(() => {
    if (!me) return;
    api.get<User[]>("/users").then(setUsers).catch(() => {});
    void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function openChannel(id: string) {
    if (!me) return;
    setSelId(id);
    const m = await api.get<ChatMessage[]>(`/chat/channels/${id}/messages`);
    setMsgs(m);
    await api.patch(`/chat/channels/${id}/read?userId=${me.id}`, {});
    await loadChannels();
  }
  async function openDm(peerId: string) {
    if (!me) return;
    const ch = await api.post<{ id: string }>("/chat/dm", { userId: me.id, peerId });
    await loadChannels();
    await openChannel(ch.id);
  }
  async function openBroadcast() {
    const ch = await api.post<{ id: string }>("/chat/broadcast", {});
    await loadChannels();
    await openChannel(ch.id);
  }
  async function createGroup() {
    if (!me || groupMembers.length < 1) return;
    const ch = await api.post<{ id: string }>("/chat/group", {
      name: groupName || "그룹",
      memberIds: [me.id, ...groupMembers],
    });
    setGroupOpen(false);
    setGroupName("");
    setGroupMembers([]);
    await loadChannels();
    await openChannel(ch.id);
  }

  async function send() {
    if (!me || !selId || !text.trim()) return;
    setBusy(true);
    try {
      const created = await api.post<ChatMessage>(`/chat/channels/${selId}/messages`, {
        userId: me.id,
        content: text.trim(),
      });
      setMsgs((cur) => [...cur, created]);
      setText("");
      await loadChannels();
    } finally {
      setBusy(false);
    }
  }
  async function togglePin(m: ChatMessage) {
    const updated = await api.patch<ChatMessage>(`/chat/messages/${m.id}/pin`, {
      pinned: !m.pinned,
    });
    setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, pinned: updated.pinned } : x)));
  }

  const selChannel = channels.find((c) => c.id === selId);
  const pinned = useMemo(() => msgs.filter((m) => m.pinned), [msgs]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>메시지</h1>
          <div className="sub">1:1 · 그룹 · 전체 공지</div>
        </div>
      </div>
      <div className="content">
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, height: "calc(100vh - 150px)" }}>
          {/* 좌: 채널 목록 */}
          <div className="card" style={{ padding: 12, overflow: "auto" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button className="btn sm" style={{ flex: 1 }} onClick={openBroadcast}>
                📢 전체
              </button>
              <button className="btn sm" style={{ flex: 1 }} onClick={() => setGroupOpen(true)}>
                ＋ 그룹
              </button>
            </div>

            {channels.length > 0 && <div className="nav-label">대화</div>}
            {channels.map((ch) => (
              <div
                key={ch.id}
                onClick={() => openChannel(ch.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: selId === ch.id ? "var(--surface-2, #eef)" : undefined,
                }}
              >
                <div className="avatar" style={{ background: ch.members.find((m) => m.id !== me?.id)?.avatarColor ?? "#4f46e5", width: 32, height: 32, fontSize: 13 }}>
                  {ch.type === "broadcast" ? "📢" : ch.type === "group" ? "👥" : channelTitle(ch, me?.id).slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{channelTitle(ch, me?.id)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ch.lastMessage ? ch.lastMessage.content : "메시지 없음"}
                  </div>
                </div>
                {ch.unread > 0 && (
                  <span style={{ background: "#dc2626", color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 6px" }}>
                    {ch.unread}
                  </span>
                )}
              </div>
            ))}

            <div className="nav-label" style={{ marginTop: 12 }}>새 1:1 대화</div>
            {users
              .filter((u) => u.id !== me?.id)
              .map((u) => (
                <div
                  key={u.id}
                  onClick={() => openDm(u.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer" }}
                >
                  <div className="avatar" style={{ background: u.avatarColor, width: 26, height: 26, fontSize: 12 }}>
                    {u.name.slice(0, 1)}
                  </div>
                  <span style={{ fontSize: 13 }}>{u.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>{u.dept ?? ""}</span>
                </div>
              ))}
          </div>

          {/* 우: 대화 */}
          <div className="card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
            {!selChannel ? (
              <div style={{ margin: "auto", color: "var(--text-3)", fontSize: 14 }}>
                왼쪽에서 대화를 선택하거나 새로 시작하세요.
              </div>
            ) : (
              <>
                <div className="panel-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <div className="sec-title">{channelTitle(selChannel, me?.id)}</div>
                  <span className="count" style={{ marginLeft: "auto" }}>
                    {selChannel.members.length}명
                  </span>
                </div>

                {pinned.length > 0 && (
                  <div style={{ padding: "10px 18px", background: "#fef9c3", borderBottom: "1px solid var(--border)" }}>
                    {pinned.map((m) => (
                      <div key={m.id} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                        📌 <b>{m.user.name}</b> {m.content}
                        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => togglePin(m)}>
                          해제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="thread" style={{ flex: 1, overflow: "auto", padding: 18 }}>
                  {msgs.length === 0 && (
                    <div style={{ color: "var(--text-3)", fontSize: 13 }}>첫 메시지를 남겨보세요.</div>
                  )}
                  {msgs.map((m) => (
                    <div key={m.id} className="msg" style={{ position: "relative" }}>
                      <div className="avatar" style={{ background: m.user.avatarColor }}>
                        {m.user.name.slice(0, 1)}
                      </div>
                      <div className="msg-body">
                        <div className="msg-top">
                          <span className="msg-name">{m.user.name}</span>
                          <span className="msg-time">{timeAgo(m.createdAt)}</span>
                          <button
                            className="btn sm"
                            style={{ marginLeft: 8, padding: "1px 7px", opacity: 0.7 }}
                            onClick={() => togglePin(m)}
                            title={m.pinned ? "고정 해제" : "공지로 고정"}
                          >
                            {m.pinned ? "📌 해제" : "📌 고정"}
                          </button>
                        </div>
                        <div className="msg-text">{m.content}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="composer" style={{ borderTop: "1px solid var(--border)" }}>
                  <input
                    className="inp"
                    placeholder="메시지 입력…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button className="btn primary sm" onClick={send} disabled={busy}>
                    전송
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 그룹 만들기 모달 */}
      {groupOpen && (
        <div
          onClick={() => setGroupOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 420, padding: 22 }}>
            <div className="sec-title mb16">
              <span className="em">👥</span> 새 그룹
            </div>
            <div className="assign-field">
              <label>그룹 이름</label>
              <input className="inp" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="예: 디자인팀" />
            </div>
            <div className="assign-field">
              <label>멤버 (나 포함 자동)</label>
              <div className="chips">
                {users
                  .filter((u) => u.id !== me?.id)
                  .map((u) => (
                    <span
                      key={u.id}
                      className={`chip${groupMembers.includes(u.id) ? " on" : ""}`}
                      onClick={() =>
                        setGroupMembers((c) =>
                          c.includes(u.id) ? c.filter((x) => x !== u.id) : [...c, u.id],
                        )
                      }
                    >
                      {u.name}
                    </span>
                  ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setGroupOpen(false)}>
                취소
              </button>
              <button className="btn primary" style={{ flex: 2 }} onClick={createGroup} disabled={groupMembers.length < 1}>
                그룹 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
