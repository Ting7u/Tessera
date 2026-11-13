// 智能分类仓库：只存名字和规则（JSON）；规则怎么变成 SQL 见 ../queries/smartRule.ts。
import type { SmartRule } from "@shared/types";
import type { AppDatabase } from "../database";

export interface SmartAlbumsRepository {
  add(name: string, rule: SmartRule): number;
  rename(id: number, name: string): boolean;
  remove(id: number): void;
  /** 取规则；不存在或规则损坏返回 null */
  ruleOf(id: number): Partial<SmartRule> | null;
  all(): { id: number; name: string; rule: Partial<SmartRule> }[];
}

export function createSmartAlbumsRepository({ prepare }: AppDatabase): SmartAlbumsRepository {
  const parse = (text: string): Partial<SmartRule> => JSON.parse(text) as Partial<SmartRule>;
  return {
    add(name, rule) {
      const info = prepare(
        "INSERT INTO smart_albums (name, rule, created_at) VALUES (?, ?, ?)",
      ).run(name, JSON.stringify(rule), Date.now());
      return Number(info.lastInsertRowid);
    },
    rename: (id, name) =>
      prepare("UPDATE smart_albums SET name = ? WHERE id = ?").run(name, id).changes > 0,
    remove(id) {
      prepare("DELETE FROM smart_albums WHERE id = ?").run(id);
    },
    ruleOf(id) {
      const row = prepare("SELECT rule FROM smart_albums WHERE id = ?").get(id) as
        | { rule: string }
        | undefined;
      return row ? parse(row.rule) : null;
    },
    all: () =>
      (
        prepare("SELECT id, name, rule FROM smart_albums ORDER BY id").all() as {
          id: number;
          name: string;
          rule: string;
        }[]
      ).map((r) => ({ id: r.id, name: r.name, rule: parse(r.rule) })),
  };
}
