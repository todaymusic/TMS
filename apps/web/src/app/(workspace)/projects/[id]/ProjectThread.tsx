"use client";

import { useState } from "react";
import { api, type Message } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ProjectThread({
  projectId,
  initial,
  members,
}: {
  projectId: string;
  initial: Message[];
  members: { id: string; name: string }[];
}) {
  const { user: me } = useAuth();
  const [msgs, setMsgs] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // @멘션 파싱: @이름 토큰을 멤버 이름과 매칭 → userId 배열
  function resolveMentions(content: string): string[] {
    const ids = new Set<string>();
    const tokens = content.match(/@(\S+)/g) ?? [];
    for (const tok of tokens) {
      const name = tok.slice(1);
      for (const m of members) {
        if (name.startsWith(m.name)) ids.add(m.id);
      }
    }
    return [...ids];
  }

  async function send() {
    const content = text.trim();
    if (!content || !me) return;
    setBusy(true);
    try {
      const created = await api.post<Message>("/messages", {
        projectId,
        userId: me.id,
        content,
        mentions: resolveMentions(content),
      });
      setMsgs((cur) => [...cur, created]);
      setText("");
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  // @멘션 토큰을 강조 표시
  function renderContent(content: string) {
    return content.split(/(@\S+)/g).map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="mention">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="card">
      <div className="panel-head">
        <div className="sec-title">
          <span className="em">💬</span> 커뮤니케이션
        </div>
        <span className="count">메시지 {msgs.length}</span>
      </div>
      <div className="thread">
        {msgs.length === 0 && (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: 8 }}>
            아직 메시지가 없습니다. 첫 메시지를 남겨보세요.
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className="msg">
            <div className="avatar" style={{ background: m.user.avatarColor }}>
              {m.user.name.slice(0, 1)}
            </div>
            <div className="msg-body">
              <div className="msg-top">
                <span className="msg-name">{m.user.name}</span>
                <span className="msg-time">
                  {new Date(m.createdAt).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="msg-text">{renderContent(m.content)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="composer">
        <input
          className="inp"
          placeholder="메시지 입력…  @멘션 가능"
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
          {busy ? "전송 중…" : "전송"}
        </button>
      </div>
    </div>
  );
}
