"use client";

import { useState } from "react";
import { api, type Priority, type TaskInProject } from "@/lib/api";

const SUBCATS = ["디자인", "개발", "마케팅", "기획", "지점업무", "교육", "운영", "인사·총무"];
const PRIOS: { key: Priority; label: string }[] = [
  { key: "urgent", label: "긴급" },
  { key: "high", label: "높음" },
  { key: "medium", label: "보통" },
  { key: "low", label: "낮음" },
];
const DEFAULT_AI_PROMPT = `당신은 업무 정의 어시스턴트입니다. 아래 간략 메모를 바탕으로 담당자가 바로 이해하고 착수할 수 있는 업무설명 문서를 작성하세요.
출력: 1) 배경/목적  2) 목표(완료기준)  3) 작업범위  4) 요구 산출물  5) 체크포인트/마감`;

export default function ProjectTaskCreateModal({
  projectId,
  projectName,
  members,
  onClose,
  onCreated,
}: {
  projectId: string;
  projectName: string;
  members: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (t: TaskInProject) => void;
}) {
  const [subcat, setSubcat] = useState("디자인");
  const [prio, setPrio] = useState<Priority>("high");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [needReport, setNeedReport] = useState(false);
  const [needVideo, setNeedVideo] = useState(false);
  const [description, setDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiDoc, setAiDoc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function genDoc() {
    if (!description.trim()) {
      setErr("상세 설명(메모)을 먼저 입력하세요");
      return;
    }
    setAiBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ doc: string }>("/ai/task-doc", {
        memo: description,
        prompt: aiPrompt,
        title,
        category: "project",
        subCategory: subcat,
      });
      setAiDoc(r.doc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 생성 실패");
    } finally {
      setAiBusy(false);
    }
  }

  async function create() {
    if (!title.trim()) {
      setErr("태스크 제목을 입력하세요");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const created = await api.post<TaskInProject>("/tasks", {
        title: title.trim(),
        category: "project",
        subCategory: subcat,
        status: "todo",
        priority: prio,
        projectId,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        reportRequired: needReport,
        videoRequired: needVideo,
        description: description.trim() || undefined,
        descriptionPrompt: aiPrompt,
        aiDescriptionDoc: aiDoc.trim() || undefined,
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "생성 실패");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50, padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", padding: 22 }}>
        <div className="sec-title mb16">
          <span className="em">📋</span> 태스크 추가 · {projectName}
        </div>

        <div className="assign-field">
          <label>소분류 (업무 영역)</label>
          <div className="chips">
            {SUBCATS.map((s) => (
              <span key={s} className={`chip${subcat === s ? " on" : ""}`} onClick={() => setSubcat(s)}>{s}</span>
            ))}
          </div>
        </div>

        <div className="assign-field">
          <label>우선순위</label>
          <div className="prio-row">
            {PRIOS.map((p) => (
              <div key={p.key} className={`prio ${p.key}${prio === p.key ? " on" : ""}`} onClick={() => setPrio(p.key)}>{p.label}</div>
            ))}
          </div>
        </div>

        <div className="assign-field">
          <label>담당자</label>
          <div className="chips">
            {members.map((m) => (
              <span key={m.id} className={`chip${assigneeId === m.id ? " on" : ""}`} onClick={() => setAssigneeId(m.id)}>{m.name}</span>
            ))}
          </div>
        </div>

        <div className="assign-field">
          <label>산출물 요구</label>
          <div className="chk-row">
            <label className="chk"><input type="checkbox" checked={needReport} onChange={(e) => setNeedReport(e.target.checked)} /> 📊 보고링크</label>
            <label className="chk"><input type="checkbox" checked={needVideo} onChange={(e) => setNeedVideo(e.target.checked)} /> 🎥 설명영상</label>
          </div>
        </div>

        <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>태스크 제목</label>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 랜딩 페이지 시안" />
          </div>
          <div>
            <label>마감일</label>
            <input className="inp" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="assign-field">
          <label>상세 설명 (간략 메모)</label>
          <textarea className="inp" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="간략히 적으면 AI가 업무설명 doc으로 정리해줘요" style={{ minHeight: 64 }} />
        </div>

        <div className="assign-field">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <label style={{ margin: 0 }}>상세 설명 프롬프트 (AI 정리)</label>
            <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setShowPrompt((s) => !s)}>
              {showPrompt ? "숨기기" : "프롬프트 수정"}
            </button>
          </div>
          {showPrompt && (
            <textarea className="inp" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} style={{ minHeight: 84 }} />
          )}
          <button type="button" className="btn" style={{ width: "100%", marginTop: 8 }} onClick={genDoc} disabled={aiBusy}>
            {aiBusy ? "생성 중…" : "🤖 AI 업무설명 doc 생성"}
          </button>
          {aiDoc && (
            <>
              <textarea className="inp" value={aiDoc} onChange={(e) => setAiDoc(e.target.value)} style={{ minHeight: 130, marginTop: 8 }} />
              <div className="field-hint">✏️ 생성된 doc — 수정 가능, 부여 시 함께 저장</div>
            </>
          )}
        </div>

        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => !busy && onClose()}>취소</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={create} disabled={busy}>
            {busy ? "생성 중…" : "태스크 생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
