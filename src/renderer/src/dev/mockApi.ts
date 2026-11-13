// 浏览器单独调试用的模拟 API：没有 Electron 时（main.tsx 检测到没有 window.api）自动装上，
// 数据在内存里，刷新页面就重置。它按 TesseraApi 的类型实现，契约变了这里会编译报错。
// 只支持最常用的操作（浏览、搜索、排序、标签、收藏）；需要系统对话框/文件系统的操作返回“已取消”或失败。
import type { TesseraApi } from "@shared/ipc/spec";
import type { I18nState, LanguagePreference } from "@shared/i18n";
import type {
  ImageRecord,
  ListParams,
  ListResult,
  SidebarData,
  SortSpec,
  TagChange,
} from "@shared/types";
import { createMockRecords, MOCK_FOLDERS } from "./mockData";

/** 一个简单的事件源：on 返回取消订阅函数，emit 通知所有订阅者 */
function createEmitter<T>() {
  const listeners = new Set<(payload: T) => void>();
  return {
    on: (cb: (payload: T) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emit: (payload: T) => listeners.forEach((cb) => cb(payload)),
  };
}

const NOT_AVAILABLE = "浏览器调试模式不支持这个操作";

function compare(a: ImageRecord, b: ImageRecord, sort: SortSpec): number {
  const dir = sort.dir === "asc" ? 1 : -1;
  switch (sort.by) {
    case "name":
      return a.name.localeCompare(b.name) * dir;
    case "size":
      return (a.size - b.size) * dir;
    case "added":
      return (a.addedAt - b.addedAt) * dir;
    default:
      return (a.takenAt - b.takenAt) * dir;
  }
}

export function installMockApi(): void {
  const records = createMockRecords();
  const byId = (id: number): ImageRecord | undefined => records.find((r) => r.id === id);
  const changed = createEmitter<void>();
  const i18nChanged = createEmitter<I18nState>();
  let i18n: I18nState = { preference: "system", language: "zh" };

  const matches = (r: ImageRecord, filter: string): boolean => {
    if (filter === "duplicate") return r.dupGroup != null;
    if (filter === "favorites") return r.favorite;
    if (filter.startsWith("folder:")) return r.path.startsWith(`${filter.slice(7)}/`);
    if (filter.startsWith("tag:")) return r.tags.includes(filter.slice(4));
    return filter === "all" || filter === "recent";
  };

  const list = async ({
    query = "",
    filter = "all",
    sort,
    limit = 200,
  }: ListParams): Promise<ListResult> => {
    const items = records.filter(
      (r) =>
        matches(r, filter) && (r.name.includes(query) || r.tags.some((tag) => tag.includes(query))),
    );
    if (sort) items.sort((a, b) => compare(a, b, sort));
    // 模拟数据只有 48 条，不做游标分页：一次给完
    return { items: items.slice(0, limit), total: items.length, nextCursor: null };
  };

  const sidebar = async (): Promise<SidebarData> => {
    const tagCounts = new Map<string, number>();
    for (const r of records)
      for (const tag of r.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    return {
      total: records.length,
      recent: records.length,
      duplicate: records.filter((r) => r.dupGroup != null).length,
      favorites: records.filter((r) => r.favorite).length,
      folders: MOCK_FOLDERS,
      tags: [...tagCounts].map(([name, count]) => ({ key: `tag:${name}`, name, count })),
      smart: [],
    };
  };

  const changeTags = (ids: number[], name: string, add: boolean): TagChange[] => {
    const out: TagChange[] = [];
    for (const id of ids) {
      const r = byId(id);
      if (!r) continue;
      r.tags = add ? [...new Set([...r.tags, name])] : r.tags.filter((tag) => tag !== name);
      out.push({ id, tags: [...r.tags] });
    }
    changed.emit();
    return out;
  };

  const none = (): (() => void) => () => {};
  const unsupported = async (): Promise<{ ok: false; error: string }> => ({
    ok: false,
    error: NOT_AVAILABLE,
  });

  const api: TesseraApi = {
    app: {
      platform: "linux",
      setTheme: () => {},
      onNotice: () => none(),
    },
    i18n: {
      initial: i18n,
      setPreference: (preference: LanguagePreference) => {
        const language = preference === "system" ? "zh" : preference;
        i18n = { preference, language };
        i18nChanged.emit(i18n);
      },
      onChange: i18nChanged.on,
    },
    library: {
      list,
      stats: async () => ({ total: records.length, duplicate: 3 }),
      sidebar,
      setActive: async () => true,
      onChanged: changed.on,
    },
    images: {
      open: unsupported,
      reveal: unsupported,
      copyImage: unsupported,
      moreMenu: unsupported,
      setFavorite: async (id, value) => {
        const r = byId(id);
        if (!r) return false;
        r.favorite = value;
        return true;
      },
      fileExists: async () => true,
    },
    importer: {
      import: async () => ({ canceled: true }),
      importPaths: async () => ({ count: 0 }),
      getImportMode: async () => "reference",
      onProgress: () => none(),
      getPathForFile: () => "",
    },
    downloads: {
      download: async () => ({
        canceled: true,
        dir: null,
        added: 0,
        skipped: 0,
        failed: 0,
        reason: "",
      }),
      cancel: async () => true,
      getDir: async () => null,
      chooseDir: async () => null,
    },
    tags: {
      addTag: async (id, name) => changeTags([id], name, true)[0]?.tags ?? null,
      removeTag: async (id, name) => changeTags([id], name, false)[0]?.tags ?? null,
      addTagToMany: async (ids, name) => changeTags(ids, name, true),
      removeTagFromMany: async (ids, name) => changeTags(ids, name, false),
      menu: async () => ({ ok: false }),
      rename: async () => ({ ok: false, error: NOT_AVAILABLE }),
      onRenameRequest: () => none(),
      onRemoved: () => none(),
    },
    smart: {
      create: async () => ({ error: NOT_AVAILABLE }),
      remove: async () => false,
      menu: async () => ({ ok: false }),
      rename: async () => ({ ok: false, error: NOT_AVAILABLE }),
      onRenameRequest: () => none(),
      onRemoved: () => none(),
    },
    folders: {
      menu: async () => ({ ok: false }),
      onRemoved: () => none(),
    },
    move: {
      preview: async (ids) => ({ movable: ids.length, managed: 0, missing: 0 }),
      choose: async () => ({ canceled: true }),
      move: unsupported,
      undo: unsupported,
      onDone: () => none(),
    },
    maintenance: {
      scanMissing: async () => ({
        total: records.length,
        lost: 0,
        unreachable: 0,
        dirs: [],
        dirCount: 0,
      }),
      cleanMissing: unsupported,
    },
  };

  window.api = api;
}
