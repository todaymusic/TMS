"use client";

import { useEffect, useState } from "react";
import { api, type Priority, type TaskDetail, type TaskStatus } from "@/lib/api";

const PRI_LABEL: Record<Priority, string> = {
  urgent: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "할일",
  doing: "진행중",
  review: "검토중",
  done: "완료",
  completed_pending: "완료(검수대기)",
};
const CAT_LABEL: Record<string, string> = { long: "롱", shorts: "쇼츠", project: "프로젝트" };

export default function TaskDetailModal({
  taskId,
  onClose,
  onSaved,
  readOnly = false,
}: {
  taskId: string;
  onClose: () => void;
  onSaved?: (t: TaskDetail) => void;
  readOnly?: boolean;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [memo, setMemo] = useState("");
  const [description, setDescription] = useState("");
  const [doc, setDoc] = useState("");
  const [reportLink, setReportLink] = useState("");
  const [videoLink, setVideoLink] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = await api.get<TaskDetail>(`/tasks/${taskId}`);
        setTask(t);
        setTitle(t.title);
        setPriority(t.priority);
        setStatus(t.status);
        setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : "");
        setProgress(t.progress);
        setMemo(t.statusMemo ?? "");
        setDescription(t.description ?? "");
        setDoc(t.aiDescriptionDoc ?? "");
        setReportLink(t.reportLink ?? "");
        setVideoLink(t.videoLink ?? "");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "불러오기 실패");
      }
    })();
  }, [taskId]);

  async function regenerateDoc() {
    if (!description.trim()) {
      setErr("AI 정리할 상세 설명을 먼저 입력하세요");
      return;
    }
    setAiBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ doc: string }>("/ai/task-doc", {
        memo: description,
        title,
        category: task?.category,
        subCategory: task?.subCategory ?? undefined,
      });
      setDoc(r.doc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI 생성 실패");
    } finally {
      setAiBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.patch<TaskDetail>(`/tasks/${taskId}`, {
        title: title.trim(),
        priority,
        status,
        progress,
        statusMemo: memo.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        description: description.trim() || undefined,
        aiDescriptionDoc: doc.trim() || undefined,
        reportLink: reportLink.trim() || undefined,
        videoLink: videoLink.trim() || undefined,
      });
      onSaved?.(updated);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  const ro = readOnly;

  return (
    <div
      onClick={() => !busy && onClose()}
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
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", padding: 22 }}
      >
        {!task ? (
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>{err ?? "불러오는 중…"}</div>
        ) : (
          <>
            <div className="panel-head">
              <div className="sec-title">
                <span className="em">📋</span> 업무 상세 {ro && <span className="pill gray">읽기 전용</span>}
              </div>
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <span className="pill gray">{CAT_LABEL[task.category] ?? task.category}</span>
                {task.subCategory && <span className="pill gray">{task.subCategory}</span>}
              </span>
            </div>

            <div className="assign-field">
              <label>제목</label>
              <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} disabled={ro} />
            </div>

            <div className="assign-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label>우선순위</label>
                <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} disabled={ro}>
                  {(Object.keys(PRI_LABEL) as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRI_LABEL[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>상태</label>
                <select className="inp" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={ro}>
                  {(["todo", "doing", "review", "done"] as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>마감일</label>
                <input className="inp" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={ro} />
              </div>
            </div>

            <div className="assign-field">
              <label>진행률 ({progress}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                disabled={ro}
                style={{ width: "100%" }}
              />
            </div>

            <div className="assign-field">
              <label>📝 진행 메모 (대시보드 공유)</label>
              <input
                className="inp"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 초안 80% 완료, 피드백 대기 중"
                disabled={ro}
              />
            </div>

            <div className="assign-field" style={{ fontSize: 13, color: "var(--text-2)" }}>
              담당자: <b>{task.assignee?.name ?? "—"}</b>
              {task.assigner && <> · 부여: {task.assigner.name}</>}
            </div>

            {(task.reportRequired || reportLink) && (
              <div className="assign-field">
                <label>📊 보고링크</label>
                <input className="inp" value={reportLink} onChange={(e) => setReportLink(e.target.value)} placeholder="https://..." disabled={ro} />
              </div>
            )}
            {(task.videoRequired || videoLink) && (
              <div className="assign-field">
                <label>🎥 설명영상</label>
                <input className="inp" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="https://..." disabled={ro} />
              </div>
            )}

            <div className="assign-field">
              <label>상세 설명 (메모)</label>
              <textarea className="inp" value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 70 }} disabled={ro} />
            </div>

            <div className="assign-field">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label style={{ margin: 0 }}>🤖 AI 업무설명 doc</label>
                {!ro && (
                  <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={regenerateDoc} disabled={aiBusy}>
                    {aiBusy ? "생성 중…" : "AI 재생성"}
                  </button>
                )}
              </div>
              <textarea
                className="inp"
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder="부여 시 생성된 업무설명 doc"
                style={{ minHeight: 140 }}
                disabled={ro}
              />
            </div>

            {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => !busy && onClose()}>
                닫기
              </button>
              {!ro && (
                <button className="btn primary" style={{ flex: 2 }} onClick={save} disabled={busy}>
                  {busy ? "저장 중…" : "저장"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
