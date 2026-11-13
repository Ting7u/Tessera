// 搜索词 → WHERE 片段。纯函数（标签命中情况由调用方先查好再传入）。
import type { Clause } from "./clause";

export const QUERY_MAX = 200;

export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, "\\$&");
/** 整体当作短语，避免用户输入被解析成 FTS 语法 */
export const ftsPhrase = (s: string): string => `"${s.replace(/"/g, '""')}"`;

/** 规整搜索词：转字符串、去首尾空格、限制长度 */
export const normalizeQuery = (query: unknown): string =>
  String(query ?? "")
    .trim()
    .slice(0, QUERY_MAX);

/** trigram 分词至少 3 个字符；1~2 个字符退化为 LIKE 扫描（渲染进程已做防抖） */
export const useFts = (q: string): boolean => [...q].length >= 3;

export const likePattern = (q: string): string => `%${escapeLike(q)}%`;

/**
 * 文件名匹配 + 标签匹配。matchedTagIds 是“名字里含搜索词的标签 id”（调用方先在极小的 tags 表里查，微秒级）：
 * 绝大多数搜索只命中文件名，走最直接的路径；只有标签确实命中时才做并集，避免所有搜索都为标签付出代价
 */
export function searchClause(q: string, matchedTagIds: number[]): Clause {
  const fts = useFts(q);
  const nameParam = fts ? ftsPhrase(q) : likePattern(q);
  if (matchedTagIds.length) {
    const nameSql = fts
      ? "SELECT rowid FROM images_fts WHERE images_fts MATCH ?"
      : `SELECT id FROM images WHERE name LIKE ? ESCAPE '\\'`;
    return {
      sql: `id IN (${nameSql} UNION SELECT image_id FROM image_tags WHERE tag_id IN (SELECT value FROM json_each(?)))`,
      params: [nameParam, JSON.stringify(matchedTagIds)],
    };
  }
  return {
    sql: fts
      ? "id IN (SELECT rowid FROM images_fts WHERE images_fts MATCH ?)"
      : `name LIKE ? ESCAPE '\\'`,
    params: [nameParam],
  };
}
