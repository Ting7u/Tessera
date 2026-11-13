/** 支持的语言 */
export type Language = "zh" | "en";
export const LANGUAGES: readonly Language[] = ["zh", "en"];

/** 用户的语言偏好：跟随系统，或固定某种语言 */
export type LanguagePreference = "system" | Language;

/** 多语言状态：偏好 + 实际生效的语言 */
export interface I18nState {
  preference: LanguagePreference;
  language: Language;
}

/** 翻译参数；传 count（数字）时按语言的复数规则选 key_one / key_other 等 */
export interface TranslateParams {
  count?: number;
  [name: string]: unknown;
}

export type Dictionary = Record<string, string>;
export type TranslateFn = (key: string, params?: TranslateParams) => string;
