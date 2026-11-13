// 图片仓库：图片记录的增删改查、列表分页、侧边栏计数、相似分组、EXIF 补读、文件夹统计。
// 只返回数据，不弹窗、不发通知、不碰文件。SQL 与旧版 Store 完全一致。
import path from "node:path";
import type {
  ImageRecord,
  LibraryStats,
  ListCursor,
  ListParams,
  ListResult,
  SidebarData,
} from "@shared/types";
import type { AppDatabase } from "../database";
import type { Clause } from "../queries/clause";
import { filterClause, RECENT_DAYS } from "../queries/filter";
import { escapeLike, normalizeQuery, searchClause } from "../queries/search";
import { DAY, ruleClause } from "../queries/smartRule";
import { resolveSort } from "../queries/sort";
import type { SmartAlbumsRepository } from "./smartAlbums";
import type { TagsRepository } from "./tags";

const PAGE_MAX = 2000;
const SIDEBAR_TAGS_MAX = 200; // 侧边栏最多返回多少个标签（按使用数量从多到少）

/** EXIF 解析结果（缺失的字段为 null） */
export interface ExifData {
  takenAt: number | null;
  camera: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  shutter: number | null;
  focalLength: number | null;
  gpsLat: number | null;
  gpsLon: number | null;
  orientation: number | null;
}

/** 新增图片所需的字段；EXIF 字段缺省按 null 处理 */
export interface NewImage extends Partial<Omit<ExifData, "takenAt">> {
  name: string;
  path: string;
  /** 图片最初的来源路径；用来判断是否已导入、推导所在文件夹 */
  sourcePath: string;
  managed: boolean;
  hash: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  takenAt: number;
  addedAt: number;
  thumb?: string | null;
  hasExifDate?: boolean;
  exifDone?: boolean;
  tags?: string[];
}

export interface MoveRow {
  id: number;
  name: string;
  path: string;
  sourcePath: string;
  managed: boolean;
  dir: string;
}

export interface ImageFileRow {
  id: number;
  path: string;
  managed: boolean;
  thumb: string | null;
}

export interface RemovedImage {
  path: string;
  managed: boolean;
  thumb: string | null;
}

export interface FolderInfo {
  count: number;
  managed: number;
}

export interface ImagesRepository {
  hasHash(hash: string): boolean;
  hasSource(file: string): boolean;
  /** 图库里是否有图片位于这个目录（确认“当前文件夹”确实是侧边栏里的文件夹） */
  hasDir(dir: string): boolean;
  /** 新增图片，返回新 id；同内容或同路径已存在则返回 0（INSERT OR IGNORE 天然防并发重复） */
  add(image: NewImage): number;
  getPath(id: number): string | null;
  setFavorite(id: number, value: boolean): boolean;
  stats(): LibraryStats;
  list(params: ListParams): ListResult<ImageRecord>;
  sidebar(): SidebarData;

  folderInfo(dir: string): FolderInfo;
  imagesForMove(ids: number[]): MoveRow[];
  /** 文件移动成功后更新记录。引用模式的图片 path 和 source_path 始终相同 */
  relocate(id: number, to: { name: string; path: string; dir: string }): boolean;
  /** 分批遍历所有图片（维护用）：按 id 递增，返回 id 大于 afterId 的前 limit 条 */
  imagesAfter(afterId: number, limit: number): { id: number; path: string; thumb: string | null }[];
  imagesByIds(ids: number[]): ImageFileRow[];
  /** 按 id 移除记录（不碰文件），同时清理无人使用的标签和剩不到 2 张的相似分组 */
  removeImages(ids: number[]): { thumb: string | null }[];
  /** 把某个文件夹的图片全部从图库移除（只匹配 dir 完全相同的，子文件夹不受影响） */
  removeFolder(dir: string): RemovedImage[];

  // 相似图片
  pendingHash(limit: number): { id: number; thumb: string | null }[];
  setHashes(entries: { id: number; phash: string }[]): void;
  allHashes(): { id: number; phash: string }[];
  /** 写入新的分组（id → 组号），只改有变化的行；返回是否有变化 */
  regroupSimilar(groups: Map<number, number>): boolean;

  // EXIF 补读
  pendingExif(afterId: number, limit: number): { id: number; path: string }[];
  /** 批量写入 EXIF：一个事务。有 EXIF 拍摄时间就覆盖 taken_at */
  applyExifBatch(entries: { id: number; exif: ExifData }[]): void;
}

// 图片列表的列；tags 用相关子查询一次带出，只对当前页的行执行
const SELECT_COLUMNS = `
  id, name, path, managed, size, width, height, format,
  taken_at AS takenAt, added_at AS addedAt, thumb, dup_group AS dupGroup,
  is_favorite AS favorite,
  camera, lens, iso, aperture, shutter, focal_length AS focalLength,
  gps_lat AS gpsLat, gps_lon AS gpsLon, orientation, has_exif_date AS hasExifDate,
  (SELECT json_group_array(t.name) FROM image_tags it JOIN tags t ON t.id = it.tag_id
    WHERE it.image_id = images.id) AS tags`;

const CLEAN_ORPHAN_TAGS =
  "DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM image_tags WHERE tag_id = tags.id)";
const CLEAN_SMALL_GROUPS = `UPDATE images SET dup_group = NULL WHERE dup_group IN (
  SELECT dup_group FROM images WHERE dup_group IS NOT NULL GROUP BY dup_group HAVING COUNT(*) < 2)`;

type ListRow = Omit<ImageRecord, "managed" | "favorite" | "hasExifDate" | "tags"> & {
  managed: number;
  favorite: number;
  hasExifDate: number;
  tags: string;
};

export function createImagesRepository(
  database: AppDatabase,
  tags: TagsRepository,
  smartAlbums: SmartAlbumsRepository,
): ImagesRepository {
  const { db, prepare } = database;

  const hasHashStmt = db.prepare("SELECT 1 FROM images WHERE hash = ?");
  const hasSourceStmt = db.prepare("SELECT 1 FROM images WHERE source_path = ?");
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO images (
      name, path, dir, source_path, managed, hash, size, width, height, format, taken_at, added_at, thumb,
      camera, lens, iso, aperture, shutter, focal_length, gps_lat, gps_lon, orientation, has_exif_date, exif_done)
    VALUES (
      @name, @path, @dir, @sourcePath, @managed, @hash, @size, @width, @height, @format, @takenAt, @addedAt, @thumb,
      @camera, @lens, @iso, @aperture, @shutter, @focalLength, @gpsLat, @gpsLon, @orientation, @hasExifDate, @exifDone)`);
  const applyExifStmt = db.prepare(`
    UPDATE images SET taken_at = COALESCE(@takenAt, taken_at), has_exif_date = @hasExifDate,
      camera = @camera, lens = @lens, iso = @iso, aperture = @aperture, shutter = @shutter,
      focal_length = @focalLength, gps_lat = @gpsLat, gps_lon = @gpsLon, orientation = @orientation, exif_done = 1
    WHERE id = @id`);
  // 分开统计：COUNT(*) 走最小索引，相似图计数走部分索引 idx_images_dup，都不用扫表
  const statsStmt = db.prepare(`SELECT
    (SELECT COUNT(*) FROM images) AS total,
    (SELECT COUNT(*) FROM images WHERE dup_group IS NOT NULL) AS duplicate`);

  const lookupRule = (id: number) => smartAlbums.ruleOf(id);
  const json = (value: unknown): string => JSON.stringify(value);

  function add(r: NewImage): number {
    const info = insertStmt.run({
      name: r.name,
      path: r.path,
      dir: path.dirname(r.sourcePath || r.path),
      sourcePath: r.sourcePath,
      managed: r.managed ? 1 : 0,
      hash: r.hash,
      size: r.size,
      width: r.width ?? 0,
      height: r.height ?? 0,
      format: r.format ?? "",
      takenAt: r.takenAt,
      addedAt: r.addedAt,
      thumb: r.thumb ?? null,
      camera: r.camera ?? null,
      lens: r.lens ?? null,
      iso: r.iso ?? null,
      aperture: r.aperture ?? null,
      shutter: r.shutter ?? null,
      focalLength: r.focalLength ?? null,
      gpsLat: r.gpsLat ?? null,
      gpsLon: r.gpsLon ?? null,
      orientation: r.orientation ?? null,
      hasExifDate: r.hasExifDate ? 1 : 0,
      exifDone: r.exifDone ? 1 : 0,
    });
    if (info.changes === 0) return 0;
    const id = Number(info.lastInsertRowid);
    if (r.tags?.length) tags.setTags(id, r.tags);
    return id;
  }

  function list({
    query = "",
    filter = "all",
    cursor = null,
    limit = 200,
    sort = null,
  }: ListParams): ListResult<ImageRecord> {
    const pageSize = Math.min(Math.max(1, Math.trunc(Number(limit)) || 200), PAGE_MAX);
    const { expr, field, numeric, order, cmp } = resolveSort(filter, sort);

    const clause = filterClause(filter, lookupRule);
    if (!clause) return { items: [], total: cursor ? null : 0, nextCursor: null };
    const where = [`(${clause.sql})`];
    const params: unknown[] = [...clause.params];

    const q = normalizeQuery(query);
    if (q) {
      const like = `%${escapeLike(q)}%`;
      const tagIds = (
        prepare(`SELECT id FROM tags WHERE name LIKE ? ESCAPE '\\'`).all(like) as { id: number }[]
      ).map((r) => r.id);
      const search = searchClause(q, tagIds);
      where.push(search.sql);
      params.push(...search.params);
    }
    const base = where.join(" AND ");

    let total: number | null = null;
    if (!cursor) {
      total = (
        prepare(`SELECT COUNT(*) AS n FROM images WHERE ${base}`).get(...params) as { n: number }
      ).n;
    }

    const pageParams = [...params];
    let pageWhere = base;
    if (cursor) {
      pageWhere += ` AND (${expr}, id) ${cmp} (?, ?)`;
      pageParams.push(numeric ? Number(cursor.value) : String(cursor.value), Number(cursor.id));
    }
    pageParams.push(pageSize + 1); // 多取一行用来判断是否还有下一页，省掉一次 COUNT
    const rows = prepare(
      `SELECT ${SELECT_COLUMNS} FROM images WHERE ${pageWhere} ORDER BY ${expr} ${order}, id ${order} LIMIT ?`,
    ).all(...pageParams) as ListRow[];

    const hasMore = rows.length > pageSize;
    if (hasMore) rows.pop();
    const items: ImageRecord[] = rows.map((row) => ({
      ...row,
      managed: !!row.managed,
      favorite: !!row.favorite,
      hasExifDate: !!row.hasExifDate,
      tags: JSON.parse(row.tags) as string[],
    }));
    const last = items[items.length - 1];
    const nextCursor: ListCursor | null =
      hasMore && last
        ? { value: last[field as keyof ImageRecord] as string | number, id: last.id }
        : null;
    return { items, total, nextCursor };
  }

  function sidebar(): SidebarData {
    const counts = prepare(`SELECT
      (SELECT COUNT(*) FROM images) AS total,
      (SELECT COUNT(*) FROM images WHERE added_at >= ?) AS recent,
      (SELECT COUNT(*) FROM images WHERE dup_group IS NOT NULL) AS duplicate,
      (SELECT COUNT(*) FROM images WHERE is_favorite = 1) AS favorites`).get(
      Date.now() - RECENT_DAYS * DAY,
    ) as Pick<SidebarData, "total" | "recent" | "duplicate" | "favorites">;
    const folders = (
      prepare(
        "SELECT dir, COUNT(*) AS count FROM images WHERE dir IS NOT NULL GROUP BY dir ORDER BY count DESC LIMIT 50",
      ).all() as { dir: string; count: number }[]
    ).map((r) => ({
      key: `folder:${r.dir}`,
      label: path.basename(r.dir) || r.dir,
      path: r.dir,
      count: r.count,
    }));
    // 所有正在使用的标签，按使用数量从多到少（数量相同按名字排）
    const tagList = (
      prepare(
        `SELECT t.name AS name, COUNT(*) AS count FROM tags t JOIN image_tags it ON it.tag_id = t.id
         GROUP BY t.id ORDER BY count DESC, t.name LIMIT ?`,
      ).all(SIDEBAR_TAGS_MAX) as { name: string; count: number }[]
    ).map((r) => ({ key: `tag:${r.name}`, name: r.name, count: r.count }));
    const smart = smartAlbums.all().map((album) => {
      const c: Clause = ruleClause(album.rule);
      const { n } = prepare(`SELECT COUNT(*) AS n FROM images WHERE ${c.sql}`).get(...c.params) as {
        n: number;
      };
      return { id: album.id, key: `smart:${album.id}`, name: album.name, count: n };
    });
    return { ...counts, folders, tags: tagList, smart };
  }

  const withManaged = <T extends { managed: number }>(
    rows: T[],
  ): (Omit<T, "managed"> & { managed: boolean })[] =>
    rows.map((r) => ({ ...r, managed: !!r.managed }));

  return {
    hasHash: (hash) => hasHashStmt.get(hash) !== undefined,
    hasSource: (file) => hasSourceStmt.get(file) !== undefined,
    hasDir: (dir) =>
      prepare("SELECT 1 FROM images WHERE dir = ? LIMIT 1").get(String(dir)) !== undefined,
    add,
    getPath: (id) =>
      (prepare("SELECT path FROM images WHERE id = ?").get(id) as { path: string } | undefined)
        ?.path ?? null,
    setFavorite: (id, value) =>
      prepare("UPDATE images SET is_favorite = ? WHERE id = ?").run(value ? 1 : 0, id).changes > 0,
    stats: () => ({ ...(statsStmt.get() as LibraryStats) }),
    list,
    sidebar,

    folderInfo: (dir) => ({
      ...(prepare(
        "SELECT COUNT(*) AS count, COALESCE(SUM(managed), 0) AS managed FROM images WHERE dir = ?",
      ).get(String(dir)) as FolderInfo),
    }),

    imagesForMove: (ids) =>
      withManaged(
        prepare(
          "SELECT id, name, path, source_path AS sourcePath, managed, dir FROM images WHERE id IN (SELECT value FROM json_each(?))",
        ).all(json(ids)) as (Omit<MoveRow, "managed"> & { managed: number })[],
      ),

    relocate: (id, { name, path: file, dir }) =>
      prepare("UPDATE images SET name = ?, path = ?, source_path = ?, dir = ? WHERE id = ?").run(
        name,
        file,
        file,
        dir,
        id,
      ).changes > 0,

    imagesAfter: (afterId, limit) =>
      prepare("SELECT id, path, thumb FROM images WHERE id > ? ORDER BY id LIMIT ?").all(
        afterId,
        limit,
      ) as {
        id: number;
        path: string;
        thumb: string | null;
      }[],

    imagesByIds: (ids) =>
      withManaged(
        prepare(
          "SELECT id, path, managed, thumb FROM images WHERE id IN (SELECT value FROM json_each(?))",
        ).all(json(ids)) as (Omit<ImageFileRow, "managed"> & { managed: number })[],
      ),

    removeImages: (ids) =>
      db.transaction(() => {
        const rows = prepare(
          "SELECT thumb FROM images WHERE id IN (SELECT value FROM json_each(?))",
        ).all(json(ids)) as { thumb: string | null }[];
        prepare("DELETE FROM images WHERE id IN (SELECT value FROM json_each(?))").run(json(ids));
        prepare(CLEAN_ORPHAN_TAGS).run();
        prepare(CLEAN_SMALL_GROUPS).run();
        return rows;
      })(),

    removeFolder: (dir) =>
      db.transaction(() => {
        const rows = prepare("SELECT path, managed, thumb FROM images WHERE dir = ?").all(
          String(dir),
        ) as {
          path: string;
          managed: number;
          thumb: string | null;
        }[];
        prepare("DELETE FROM images WHERE dir = ?").run(String(dir));
        prepare(CLEAN_ORPHAN_TAGS).run();
        prepare(CLEAN_SMALL_GROUPS).run();
        return rows.map((r) => ({ path: r.path, managed: !!r.managed, thumb: r.thumb }));
      })(),

    pendingHash: (limit) =>
      prepare("SELECT id, thumb FROM images WHERE phash IS NULL ORDER BY id LIMIT ?").all(
        limit,
      ) as {
        id: number;
        thumb: string | null;
      }[],

    setHashes(entries) {
      const stmt = prepare("UPDATE images SET phash = ? WHERE id = ?");
      db.transaction(() => {
        for (const e of entries) stmt.run(e.phash, e.id);
      })();
    },

    allHashes: () =>
      prepare("SELECT id, phash FROM images WHERE phash IS NOT NULL AND phash != ''").all() as {
        id: number;
        phash: string;
      }[],

    regroupSimilar(groups) {
      const current = new Map(
        (
          prepare("SELECT id, dup_group FROM images WHERE dup_group IS NOT NULL").all() as {
            id: number;
            dup_group: number;
          }[]
        ).map((r) => [r.id, r.dup_group]),
      );
      const clear = prepare("UPDATE images SET dup_group = NULL WHERE id = ?");
      const set = prepare("UPDATE images SET dup_group = ? WHERE id = ?");
      let changed = false;
      db.transaction(() => {
        for (const id of current.keys()) {
          if (!groups.has(id)) {
            clear.run(id);
            changed = true;
          }
        }
        for (const [id, g] of groups) {
          if (current.get(id) !== g) {
            set.run(g, id);
            changed = true;
          }
        }
      })();
      return changed;
    },

    pendingExif: (afterId, limit) =>
      prepare("SELECT id, path FROM images WHERE exif_done = 0 AND id > ? ORDER BY id LIMIT ?").all(
        afterId,
        limit,
      ) as {
        id: number;
        path: string;
      }[],

    applyExifBatch(entries) {
      db.transaction(() => {
        for (const { id, exif: e } of entries) {
          applyExifStmt.run({
            id,
            takenAt: e.takenAt ?? null,
            hasExifDate: e.takenAt != null ? 1 : 0,
            camera: e.camera ?? null,
            lens: e.lens ?? null,
            iso: e.iso ?? null,
            aperture: e.aperture ?? null,
            shutter: e.shutter ?? null,
            focalLength: e.focalLength ?? null,
            gpsLat: e.gpsLat ?? null,
            gpsLon: e.gpsLon ?? null,
            orientation: e.orientation ?? null,
          });
        }
      })();
    },
  };
}
