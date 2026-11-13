// 图库维护：找出“原文件已经不存在”的图片，由用户确认后才移除记录。
// 为什么不自动清理：图片在移动硬盘 / 网络盘上时，设备没连接，所有文件看起来都“丢了”，自动清理会把图库清空。
// 所以分成两类：
//   lost        文件不存在，但它所在的文件夹还在 —— 基本可以确定是被删了
//   unreachable 连所在的文件夹都找不到 —— 可能是硬盘没连接、文件夹被移走，需要用户自己判断
// 渲染进程不传任何 id 或路径，只说“清理哪一类”；真正的名单由主进程自己扫描得出，删除前还会再核对一次。
import path from "node:path";
import type { BrowserWindow } from "electron";
import type { CleanMissingKind, CleanMissingResult, ScanMissingResult } from "@shared/types";
import { showMessageBox } from "../../core/dialogs";
import { probe, type Probe } from "../../core/fsUtils";
import { broadcast } from "../../core/ipc";
import type { ImagesRepository, RemovedImage } from "../../db/repositories";

const BATCH = 2000; // 每批从数据库读多少条
const CONCURRENCY = 32; // 同时检查多少个文件（异步，不会卡住界面）
const SAMPLE = 5; // 结果里最多列出几个示例路径

export interface MaintenanceDeps {
  images: Pick<ImagesRepository, "getPath" | "imagesAfter" | "imagesByIds" | "removeImages">;
  deleteThumbs: (rows: Pick<RemovedImage, "thumb">[]) => Promise<void>;
}

export interface Maintenance {
  /** 这张图片的原文件还在不在。只有确认“不存在”才返回 false；其他情况（有权限问题等）按“在”处理 */
  fileExists(id: number | null): Promise<boolean>;
  scan(): Promise<ScanMissingResult>;
  clean(win: BrowserWindow | null, kind: unknown): Promise<CleanMissingResult>;
}

interface Classified {
  lost: number[];
  unreachable: number[];
  /** 找不到的文件夹 */
  dirs: string[];
}

/** 判断一批图片各属于哪一类 */
async function classify(rows: { id: number; path: string }[]): Promise<Classified> {
  const lost: number[] = [];
  const unreachable: number[] = [];
  const missingDirs = new Set<string>();
  const parents = new Map<string, Promise<Probe>>(); // 同一个文件夹只检查一次
  const parentState = (dir: string): Promise<Probe> => {
    let state = parents.get(dir);
    if (!state) {
      state = probe(dir);
      parents.set(dir, state);
    }
    return state;
  };
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < rows.length) {
      const row = rows[next++];
      if ((await probe(row.path)) !== "no") continue;
      const dir = path.dirname(row.path);
      const state = await parentState(dir);
      if (state === "yes") {
        lost.push(row.id);
      } else if (state === "no") {
        unreachable.push(row.id);
        missingDirs.add(dir);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  return { lost, unreachable, dirs: [...missingDirs] };
}

export function createMaintenance({ images, deleteThumbs }: MaintenanceDeps): Maintenance {
  let lastScan: { lost: number[]; unreachable: number[] } | null = null;

  return {
    async fileExists(id) {
      const file = id ? images.getPath(id) : null;
      if (!file) return false;
      return (await probe(file)) !== "no";
    },

    async scan() {
      const lost: number[] = [];
      const unreachable: number[] = [];
      const dirs = new Set<string>();
      let total = 0;
      let after = 0;
      for (;;) {
        const rows = images.imagesAfter(after, BATCH);
        if (!rows.length) break;
        after = rows[rows.length - 1].id;
        total += rows.length;
        const r = await classify(rows);
        lost.push(...r.lost);
        unreachable.push(...r.unreachable);
        r.dirs.forEach((d) => dirs.add(d));
      }
      lastScan = { lost, unreachable };
      return {
        total,
        lost: lost.length,
        unreachable: unreachable.length,
        dirs: [...dirs].slice(0, SAMPLE),
        dirCount: dirs.size,
      };
    },

    async clean(win, kind) {
      if ((kind !== "lost" && kind !== "unreachable") || !lastScan)
        return { ok: false, error: "请先点“检查”" };
      const k: CleanMissingKind = kind;
      const candidates = lastScan[k];
      if (!candidates.length) return { ok: true, removed: 0 };

      const lostKind = k === "lost";
      const { response } = await showMessageBox(win, {
        type: "warning",
        buttons: ["移除记录", "取消"],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: "清理已丢失的图片",
        message: `从图库移除 ${candidates.length} 张${lostKind ? "原文件已被删除" : "所在文件夹找不到"}的图片？`,
        detail: lostKind
          ? "只移除图库里的记录和缩略图，不会删除任何文件。"
          : "这些图片所在的整个文件夹都找不到了，可能是移动硬盘或网络盘没有连接，也可能是文件夹被移走了。\n\n如果只是设备没连接，请先连接好再说，移除后需要重新导入才能找回。\n\n只移除图库里的记录和缩略图，不会删除任何文件。",
      });
      if (response !== 0) return { ok: true, removed: 0, canceled: true };

      // 删除前再核对一次：这期间文件可能已经回来了（比如硬盘刚接上），只移除这一刻仍然符合条件的
      const rows: { id: number; path: string }[] = [];
      for (let i = 0; i < candidates.length; i += BATCH)
        rows.push(...images.imagesByIds(candidates.slice(i, i + BATCH)));
      const again = await classify(rows);
      const ids = again[k];
      for (let i = 0; i < ids.length; i += BATCH) {
        const removed = images.removeImages(ids.slice(i, i + BATCH));
        await deleteThumbs(removed);
      }
      lastScan = null; // 名单已经过期，要求重新检查
      broadcast("library:changed");
      broadcast("library:notice", { text: `已移除 ${ids.length} 张已丢失的图片` });
      return { ok: true, removed: ids.length };
    },
  };
}
