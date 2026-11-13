// 智能分类的规则 → WHERE 片段。纯函数。
import type { SmartRule } from "@shared/types";
import type { Clause } from "./clause";

export const DAY = 86400000;

/** 规则里的标签列表：新规则存在 tags（数组），旧规则只有 tag（单个），两种都认 */
export function ruleTags(rule: Partial<SmartRule>): string[] {
  const list = Array.isArray(rule.tags) ? rule.tags : [];
  return [
    ...new Set(
      [...list, ...(rule.tag ? [rule.tag] : [])].filter((n) => typeof n === "string" && n),
    ),
  ];
}

/** 多个条件取交集；标签之间是“或”，和其他条件之间仍然是“且” */
export function ruleClause(rule: Partial<SmartRule>, now: number = Date.now()): Clause {
  const sql: string[] = [];
  const params: unknown[] = [];
  if (rule.days) {
    sql.push("taken_at >= ?");
    params.push(now - rule.days * DAY);
  }
  const tags = ruleTags(rule);
  if (tags.length) {
    sql.push(`id IN (SELECT it.image_id FROM image_tags it JOIN tags t ON t.id = it.tag_id
      WHERE t.name IN (SELECT value FROM json_each(?)))`);
    params.push(JSON.stringify(tags));
  }
  if (rule.minSizeMB) {
    sql.push("size >= ?");
    params.push(rule.minSizeMB * 1024 * 1024);
  }
  if (rule.favorite) sql.push("is_favorite = 1");
  return { sql: sql.length ? sql.join(" AND ") : "1", params };
}
