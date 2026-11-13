// 属于 app 层的 IPC：主题切换（标题栏按钮颜色）、语言。
import { broadcast, onSend, onSync } from "../core/ipc";
import { getI18nState, onLanguageChange, setPreference } from "../core/i18n";
import { applyTitleBarTheme } from "./window";

export function registerAppIpc(): void {
  onSend("theme-changed", ({ window }, theme) => applyTitleBarTheme(window, theme));

  // 页面加载前 preload 会同步来取一次初始值（所以第一帧就是对的语言）；
  // 之后在设置里切换，这里保存并通知所有窗口
  onSync("i18n:get", () => getI18nState());
  onSend("i18n:set", (_ctx, preference) => setPreference(preference));
  onLanguageChange((state) => broadcast("i18n:changed", state));
}
