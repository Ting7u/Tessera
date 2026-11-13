// 标签仓库：标签的增删改、合并、重命名。只管数据，不弹窗、不发通知。
import type { TagChange, SmartRule } from "@shared/types";
import { ruleTags } from "../queries/smartRule";
import type { AppDatabase } from "../database";

export interface TagInfo {
  /** 使用这个标签的图片数 */
  count: number;
  /** 按这个标签筛选的智能分类名 */
  smart: string[];
}

export interface TagsRepository {
  /** 给一张图片挂上若干标签（不存在的标签先创建），一个事务 */
  setTags(imageId: number, names: string[]): void;
  tagsOf(imageId: number): string[];
  /** 给图片加标签，返回该图片最新的标签列表；重复添加不会报错 */
  addTag(imageId: number, name: string): string[];
  /** 给多张图片加同一个标签（一个事务）。已被删除的图片会被跳过 */
  addTagToMany(imageIds: number[], name: string): TagChange[];
  /** 从多张图片上移除同一个标签；没人再用的标签会被清理 */
  removeTagFromMany(imageIds: number[], name: string): TagChange[];
  /** 移除标签，没有任何图片再使用的标签会被一并清理 */
  removeTag(imageId: number, name: string): string[];
  tagInfo(name: string): TagInfo;
  /** 重命名标签。新名字已存在时合并；按这个标签筛选的智能分类，规则里的标签名一起改掉 */
  renameTag(from: string, to: string): { merged: boolean };
  /** 删除标签：从所有图片上摘掉，图片本身不受影响 */
  deleteTag(name: string): void;
  /** 在给定的标签名里，挑出图库里真实存在的 */
  existingTagNames(names: string[]): string[];
}

export function createTagsRepository(database: AppDatabase): TagsRepository {
  const { db, prepare } = database;
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  const tagId = db.prepare("SELECT id FROM tags WHERE name = ?");
  const linkTag = db.prepare("INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)");

  const idOf = (name: string): number | undefined =>
    (tagId.get(name) as { id: number } | undefined)?.id;

  const setTags = (imageId: number, names: string[]): void => {
    db.transaction(() => {
      for (const name of names) {
        insertTag.run(name);
        linkTag.run(imageId, idOf(name));
      }
    })();
  };

  const tagsOf = (imageId: number): string[] => {
    const row = prepare(
      `SELECT json_group_array(t.name) AS tags FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE it.image_id = ?`,
    ).get(imageId) as { tags: string };
    return JSON.parse(row.tags) as string[];
  };

  const existingImageIds = (imageIds: number[]): number[] =>
    (
      prepare("SELECT id FROM images WHERE id IN (SELECT value FROM json_each(?))").all(
        JSON.stringify(imageIds),
      ) as { id: number }[]
    ).map((r) => r.id);

  const dropIfUnused = (id: number): void => {
    prepare(
      "DELETE FROM tags WHERE id = ? AND NOT EXISTS (SELECT 1 FROM image_tags WHERE tag_id = ?)",
    ).run(id, id);
  };

  return {
    setTags,
    tagsOf,

    addTag(imageId, name) {
      setTags(imageId, [name]);
      return tagsOf(imageId);
    },

    addTagToMany(imageIds, name) {
      const existing = existingImageIds(imageIds);
      if (!existing.length) return [];
      db.transaction(() => {
        insertTag.run(name);
        const id = idOf(name);
        for (const imageId of existing) linkTag.run(imageId, id);
      })();
      return existing.map((id) => ({ id, tags: tagsOf(id) }));
    },

    removeTagFromMany(imageIds, name) {
      const existing = existingImageIds(imageIds);
      const id = idOf(name);
      if (id !== undefined && existing.length) {
        db.transaction(() => {
          prepare(
            "DELETE FROM image_tags WHERE tag_id = ? AND image_id IN (SELECT value FROM json_each(?))",
          ).run(id, JSON.stringify(existing));
          dropIfUnused(id);
        })();
      }
      return existing.map((imageId) => ({ id: imageId, tags: tagsOf(imageId) }));
    },

    removeTag(imageId, name) {
      const id = idOf(name);
      if (id !== undefined) {
        db.transaction(() => {
          prepare("DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?").run(imageId, id);
          dropIfUnused(id);
        })();
      }
      return tagsOf(imageId);
    },

    tagInfo(name) {
      const { n } = prepare(
        "SELECT COUNT(*) AS n FROM image_tags it JOIN tags t ON t.id = it.tag_id WHERE t.name = ?",
      ).get(name) as { n: number };
      const smart = (
        prepare("SELECT name, rule FROM smart_albums").all() as { name: string; rule: string }[]
      )
        .filter((r) => {
          try {
            return ruleTags(JSON.parse(r.rule) as Partial<SmartRule>).includes(name);
          } catch {
            return false;
          }
        })
        .map((r) => r.name);
      return { count: n, smart };
    },

    renameTag(from, to) {
      return db.transaction(() => {
        const src = idOf(from);
        if (src === undefined) return { merged: false };
        const dst = idOf(to);
        if (dst !== undefined) {
          prepare(
            "INSERT OR IGNORE INTO image_tags (image_id, tag_id) SELECT image_id, ? FROM image_tags WHERE tag_id = ?",
          ).run(dst, src);
          prepare("DELETE FROM image_tags WHERE tag_id = ?").run(src);
          prepare("DELETE FROM tags WHERE id = ?").run(src);
        } else {
          prepare("UPDATE tags SET name = ? WHERE id = ?").run(to, src);
        }
        for (const row of prepare("SELECT id, rule FROM smart_albums").all() as {
          id: number;
          rule: string;
        }[]) {
          let rule: Partial<SmartRule>;
          try {
            rule = JSON.parse(row.rule) as Partial<SmartRule>;
          } catch {
            continue;
          }
          const names = ruleTags(rule);
          if (names.includes(from)) {
            rule.tags = [...new Set(names.map((n) => (n === from ? to : n)))]; // 合并时可能出现重复，去重
            delete rule.tag;
            prepare("UPDATE smart_albums SET rule = ? WHERE id = ?").run(
              JSON.stringify(rule),
              row.id,
            );
          }
        }
        return { merged: dst !== undefined };
      })();
    },

    deleteTag(name) {
      const id = idOf(name);
      if (id === undefined) return;
      db.transaction(() => {
        prepare("DELETE FROM image_tags WHERE tag_id = ?").run(id);
        prepare("DELETE FROM tags WHERE id = ?").run(id);
      })();
    },

    existingTagNames: (names) => names.filter((n) => idOf(n) !== undefined),
  };
}
