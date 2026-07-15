"use client";

import { useEffect, useRef, type MouseEvent } from "react";

/**
 * 모달 배경(오버레이) 클릭으로 닫을 때, 실수로 내용이 날아가지 않게 보호하는 훅.
 *
 * 3중 보호:
 *  1) 열림 직후 짧은 시간(graceMs)은 배경 클릭 무시 → 카드 더블클릭으로 열자마자
 *     닫혀버리는("너무 클릭하면 빠르게 사라짐") 현상 방지.
 *  2) 배경에서 "눌렀다 뗀" 클릭만 닫기로 인정 → textarea 드래그 선택 중 바깥에서
 *     손 떼는 오버슈팅으로는 안 닫힘.
 *  3) 작성 중인 내용(isDirty)이 있으면 confirm으로 한 번 더 확인.
 *
 * 사용: 오버레이 div에 스프레드.
 *   const backdrop = useBackdropClose({ isDirty: () => note !== "", close: onClose, busy });
 *   <div {...backdrop} style={...overlay}>
 *
 * 부모에 얹혀 조건부로 열리는 모달(컴포넌트가 언마운트되지 않는 경우)은
 * resetKey에 열림 식별자(예: 대상 id)를 넘겨 열릴 때마다 보호시간을 재시작한다.
 */
export function useBackdropClose(opts: {
  isDirty: () => boolean;
  close: () => void;
  busy?: boolean;
  message?: string;
  graceMs?: number;
  resetKey?: unknown;
}) {
  const downOnBackdrop = useRef(false);
  const openedAt = useRef(Date.now());
  const grace = opts.graceMs ?? 400;
  const msg = opts.message ?? "작성 중인 내용이 있어요. 저장하지 않고 닫을까요?";

  // 모달이 (다시) 열릴 때마다 보호시간 재시작
  useEffect(() => {
    openedAt.current = Date.now();
  }, [opts.resetKey]);

  return {
    onMouseDown: (e: MouseEvent) => {
      // 배경(오버레이) 자체에서 누른 경우만 기록
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: MouseEvent) => {
      if (opts.busy) return;
      if (Date.now() - openedAt.current < grace) return; // 방금 열림 → 즉시 닫힘 방지
      if (e.target !== e.currentTarget) return; // 내부에서 올라온 클릭 무시
      if (!downOnBackdrop.current) return; // 안에서 시작한 드래그(오버슈팅) 무시
      if (opts.isDirty() && !window.confirm(msg)) return;
      opts.close();
    },
  };
}
