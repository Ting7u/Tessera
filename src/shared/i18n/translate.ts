// 翻译的核心逻辑：主进程和渲染进程共用这一份（以前是两份拷贝，改一处要记得改另一处）。
import type { Dictionary, Language, TranslateParams } from "./languages";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const dictionaries: Record<Language, Dictionary> = { zh, en };

/** 把模板里的 {name} 换成参数；参数里没有就保留原样 */
export function format(template: string, params?: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
    params && params[name] != null ? String(params[name]) : match,
  );
}

/**
 * 翻译。查找顺序：当前语言 → 中文 → 键名本身（显示键名方便发现遗漏）。
 * 传 params.count 时按复数规则查 `${key}_${category}`，再退回 `${key}_other`。
 * @param onMissing 键在所有词典里都找不到时的回调（渲染进程开发模式下用来打印警告）
 */
export function translate(
  language: Language,
  key: string,
  params?: TranslateParams,
  onMissing?: (key: string) => void,
): string {
  const dict = dictionaries[language] || dictionaries.zh;
  let template: string | undefined;
  if (params && typeof params.count === "number") {
    const category = new Intl.PluralRules(language).select(params.count);
    template = dict[`${key}_${category}`] ?? dict[`${key}_other`];
  }
  template ??= dict[key] ?? dictionaries.zh[key];
  if (template === undefined) {
    onMissing?.(key);
    template = key;
  }
  return format(template, params);
}
