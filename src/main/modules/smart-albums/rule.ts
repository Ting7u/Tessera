import type { SmartRule } from "@shared/types";
import { cleanTag } from "../../core/sanitize";

/** 规则只接受固定的几个字段并做范围限制（纯函数）；真正的 SQL 由 db/queries/smartRule 拼接，全部参数绑定 */
export function cleanRule(raw: unknown): SmartRule {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const days = Math.min(3650, Math.max(0, Math.trunc(Number(r.days)) || 0));
  // 标签：数组或用逗号/分号隔开的字符串都收（兼容旧界面传来的单个 tag），去重，最多 20 个
  const rawTags: unknown[] =
    typeof r.tags === "string" ? r.tags.split(/[,;，；、]/) : Array.isArray(r.tags) ? r.tags : [];
  const tags = [...new Set([...rawTags, r.tag].map(cleanTag).filter(Boolean))].slice(0, 20);
  return {
    days,
    tags,
    minSizeMB: Math.min(100000, Math.max(0, Number(r.minSizeMB) || 0)),
    favorite: !!r.favorite,
  };
}
