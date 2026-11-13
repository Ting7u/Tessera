// 主进程的多语言：弹窗、右键菜单、通知、错误信息都用这里的 t()。
// 语言偏好单独存在 language.json，不和 settings.json 混在一起：
//   1. 启动时（图库还没初始化）就能读到，启动阶段的弹窗也是对的语言
//   2. 两个文件各管各的，不会互相覆盖
// 翻译本身在 @shared/i18n/translate（渲染进程共用）。
import fs from "node:fs";
import { app } from "electron";
import {
  LANGUAGES,
  translate,
  type I18nState,
  type Language,
  type LanguagePreference,
  type TranslateFn,
} from "@shared/i18n";
import { createLogger } from "../logger";

const log = createLogger("i18n");
const listeners = new Set<(state: I18nState) => void>();
let file = "";
let preference: LanguagePreference = "system";

/** 启动时调用一次：读取保存的语言偏好 */
export function initI18n(languageFile: string): void {
  file = languageFile;
  try {
    const saved: unknown = (JSON.parse(fs.readFileSync(file, "utf8")) as { preference?: unknown })
      .preference;
    if (saved === "system" || LANGUAGES.includes(saved as Language)) {
      preference = saved as LanguagePreference; // 上一行已校验
    }
  } catch {
    /* 第一次启动没有文件，或文件损坏：跟随系统 */
  }
}

function systemLanguage(): Language {
  const locale = app.isReady() ? app.getLocale() : ""; // getLocale 要在 ready 之后才可靠
  return String(locale).toLowerCase().startsWith("zh") ? "zh" : "en";
}

export const getPreference = (): LanguagePreference => preference;
export const getLanguage = (): Language =>
  preference === "system" ? systemLanguage() : preference;
export const getI18nState = (): I18nState => ({ preference, language: getLanguage() });

/** 翻译：每次调用时才取当前语言，所以切换语言后立即生效 */
export const t: TranslateFn = (key, params) => translate(getLanguage(), key, params);

export function setPreference(next: LanguagePreference): void {
  if (next !== "system" && !LANGUAGES.includes(next)) return;
  if (next === preference) return;
  preference = next;
  try {
    fs.writeFileSync(file, JSON.stringify({ preference }, null, 2));
  } catch (err) {
    log.error("save failed:", err); // 写盘失败时本次运行内仍然生效
  }
  const state = getI18nState();
  for (const fn of listeners) fn(state);
}

/** 订阅语言变化，返回取消订阅函数 */
export function onLanguageChange(fn: (state: I18nState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
