// 侧边栏 filter → WHERE 片段。纯函数（智能分类的规则由调用方通过 lookup 提供）。
import type { SmartRule } from "@shared/types";
import type { Clause } from "./clause";
import { DAY, ruleClause } from "./smartRule";

export const RECENT_DAYS = 7; // “最近导入”：最近 7 天内导入的

/**
 * 不认识的 filter 返回 null（调用方按“空列表”处理，不会再出现“没写逻辑的分类悄悄显示全部图片”）。
 *   all / recent / duplicate / favorites / folder:<目录> / tag:<标签名> / smart:<id>
 */
export function filterClause(
  filter: unknown,
  lookupSmartRule: (id: number) => Partial<SmartRule> | null,
  now: number = Date.now(),
): Clause | null {
  if (typeof filter !== "string") return null;
  if (filter === "all") return { sql: "1", params: [] };
  if (filter === "recent") return { sql: "added_at >= ?", params: [now - RECENT_DAYS * DAY] };
  if (filter === "duplicate") return { sql: "dup_group IS NOT NULL", params: [] };
  if (filter === "favorites") return { sql: "is_favorite = 1", params: [] };
  if (filter.startsWith("folder:")) return { sql: "dir = ?", params: [filter.slice(7)] };
  if (filter.startsWith("tag:")) {
    return {
      sql: "id IN (SELECT it.image_id FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name = ?)",
      params: [filter.slice(4)],
    };
  }
  if (filter.startsWith("smart:")) {
    const id = Number(filter.slice(6));
    if (!Number.isSafeInteger(id)) return null;
    const rule = lookupSmartRule(id);
    return rule ? ruleClause(rule, now) : null;
  }
  return null;
}
