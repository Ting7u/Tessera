import { useEffect, useRef } from "react";

/**
 * 按 Esc 时调用 onEscape（弹窗、详情层共用）。
 * 输入法合成中（拼音还没选字）的 Esc 属于输入法，不触发。enabled 为 false 时不监听。
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !event.isComposing) handler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
