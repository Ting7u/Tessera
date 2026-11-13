// 界面的多语言：组件里 const t = useT()，然后 t("键名") / t("键名", { count: 3 })。
// 语言由主进程保存和广播；这里只负责“当前用哪种语言”和“翻译”。翻译核心在 @shared/i18n（主进程共用）。
import { useCallback } from "react";
import { create } from "zustand";
import {
  translate,
  type I18nState,
  type Language,
  type LanguagePreference,
  type TranslateFn,
} from "@shared/i18n";
import { api } from "../api";

export type { TranslateFn };

// preload 在页面加载前就同步取好了初始值，所以第一帧就是对的语言，不会闪一下
const initial: I18nState = api.i18n.initial;

export const useI18nStore = create<I18nState>()(() => ({
  preference: initial.preference,
  language: initial.language,
}));

const applyDocumentLanguage = (language: Language): void => {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
};
applyDocumentLanguage(initial.language);

// 主进程在语言变化时广播过来（包括在设置里切换之后）
api.i18n.onChange((state) => {
  useI18nStore.setState(state);
  applyDocumentLanguage(state.language);
});

const warnMissing = (key: string): void => {
  if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
};

/** 组件里用：语言一变，用到它的组件自动重新渲染 */
export function useT(): TranslateFn {
  const language = useI18nStore((s) => s.language);
  return useCallback<TranslateFn>(
    (key, params) => translate(language, key, params, warnMissing),
    [language],
  );
}

/** 组件外（store、工具函数里）用：取当前语言翻译，不会触发重新渲染 */
export const t: TranslateFn = (key, params) =>
  translate(useI18nStore.getState().language, key, params, warnMissing);

/** 设置界面用：当前偏好 */
export const usePreference = (): LanguagePreference => useI18nStore((s) => s.preference);

/** 设置界面用：切换语言。保存和广播由主进程完成，随后 onChange 会更新这里的状态 */
export const setLanguagePreference = (preference: LanguagePreference): void =>
  api.i18n.setPreference(preference);

/** 当前语言对应的 Intl 区域标记，格式化日期和数字时用 */
export const currentLocale = (): "zh-CN" | "en-US" =>
  useI18nStore.getState().language === "zh" ? "zh-CN" : "en-US";
