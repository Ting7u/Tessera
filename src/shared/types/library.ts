// 图库列表、侧边栏相关的数据结构

export type SortBy = "taken" | "added" | "name" | "size";
export type SortDir = "asc" | "desc";
export interface SortSpec {
  by: SortBy;
  dir: SortDir;
}

/** keyset 分页游标：上一页最后一条的排序列值 + id */
export interface ListCursor {
  value: number | string;
  id: number;
}

/**
 * filter 取值：all / recent / duplicate / favorites / folder:<目录> / tag:<标签名> / smart:<id>
 * 不认识的 filter 主进程按“空列表”处理。
 */
export type LibraryFilter = string;

export interface ListParams {
  query?: string;
  filter?: LibraryFilter;
  cursor?: ListCursor | null;
  limit?: number;
  sort?: SortSpec | null;
}

export interface ListResult<TItem = import("./image").ImageRecord> {
  items: TItem[];
  /** 仅首页（无 cursor）时计算，翻页时为 null */
  total: number | null;
  /** null 表示到底了 */
  nextCursor: ListCursor | null;
}

export interface LibraryStats {
  total: number;
  duplicate: number;
}

export interface SidebarFolder {
  key: string;
  label: string;
  path: string;
  count: number;
}
export interface SidebarTag {
  key: string;
  name: string;
  count: number;
}
export interface SidebarSmart {
  id: number;
  key: string;
  name: string;
  count: number;
}
export interface SidebarData {
  total: number;
  recent: number;
  duplicate: number;
  favorites: number;
  folders: SidebarFolder[];
  tags: SidebarTag[];
  smart: SidebarSmart[];
}

/** 智能分类的规则：几个条件取交集（标签之间是“或”） */
export interface SmartRule {
  days: number;
  tags: string[];
  minSizeMB: number;
  favorite: boolean;
  /** 旧版规则只有单个 tag，读取时兼容 */
  tag?: string;
}

export type SmartCreateResult =
  | { id: number; dropped: string[] }
  | { error: string };

export type SmartRenameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export type TagRenameResult =
  | { ok: true; name: string; merged?: boolean }
  | { ok: false; error?: string; canceled?: boolean };
