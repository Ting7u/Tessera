// 移动图片：把原文件真正移到另一个文件夹。
// 目标必须是图库里已有的文件夹，或刚刚由主进程的选择框选出来的文件夹，不接受任意路径。
// 复制模式（托管）的图片文件在图库目录里统一管理，这次不移动，会在结果里说明。
import path from "node:path";
import type { MovePreview, MoveResult, UndoMoveResult } from "@shared/types";
import { isDirectory, isRegularFile } from "../../core/fsUtils";
import { broadcast } from "../../core/ipc";
import { createLogger } from "../../core/logger";
import { say } from "../../core/notify";
import type { ImagesRepository, MoveRow } from "../../db/repositories";
import { moveNoOverwrite, uniqueDest } from "./moveFile";

const log = createLogger("move");

interface MoveEntry {
  id: number;
  from: string;
  to: string;
  /** 移动前所在的文件夹 */
  dir: string;
}

interface RunResult {
  entries: MoveEntry[];
  moved: number;
  same: number;
  managed: number;
  missing: number;
  failed: number;
  error: string;
}

type MoverImages = Pick<ImagesRepository, "imagesForMove" | "hasSource" | "hasDir" | "relocate">;

const errorText = (err: unknown): string => {
  const e = err as NodeJS.ErrnoException;
  return e.code === "EACCES" || e.code === "EPERM" ? "没有权限" : e.message;
};

function describe(r: Omit<RunResult, "entries">, destDir: string): string {
  const label = path.basename(destDir) || destDir;
  const parts: string[] = [];
  if (r.moved) parts.push(`已移动 ${r.moved} 张到“${label}”`);
  if (r.same) parts.push(`${r.same} 张本来就在这个文件夹`);
  if (r.managed) parts.push(`${r.managed} 张复制模式的图片未移动`);
  if (r.missing) parts.push(`${r.missing} 张原文件不存在，已跳过`);
  if (r.failed) parts.push(`${r.failed} 张移动失败${r.error ? `（${r.error}）` : ""}`);
  return parts.join("，") || "没有可移动的图片";
}

export interface Mover {
  preview(ids: number[]): MovePreview;
  /** 记下选择框选出的文件夹（只有它和图库里已有的文件夹才允许作为目标） */
  allowDir(dir: string): void;
  move(ids: number[], dir: string): Promise<MoveResult>;
  undo(token: string): Promise<UndoMoveResult>;
}

export function createMover({ images }: { images: MoverImages }): Mover {
  let chosenDir: string | null = null;
  let queue: Promise<unknown> = Promise.resolve(); // 移动任务排队执行，避免两次移动同时改同一批文件
  let lastMove: { token: string; entries: MoveEntry[] } | null = null; // 只保留最近一次，只在内存里，退出应用后不能再撤销

  /** 把图片分成：能移动的 / 复制模式的 / 原文件不存在的 */
  function sortRows(ids: number[]): { movable: MoveRow[]; managed: MoveRow[]; missing: MoveRow[] } {
    const movable: MoveRow[] = [];
    const managed: MoveRow[] = [];
    const missing: MoveRow[] = [];
    for (const row of images.imagesForMove(ids)) {
      if (row.managed || row.path !== row.sourcePath) managed.push(row);
      else if (!isRegularFile(row.path)) missing.push(row);
      else movable.push(row);
    }
    return { movable, managed, missing };
  }

  /** 移动一张图片：搬文件、更新记录，更新失败就搬回去。name 为想用的文件名（撤销时用来恢复原名） */
  async function moveOne(
    row: MoveRow,
    destDir: string,
    name: string = path.basename(row.path),
  ): Promise<string> {
    const dest = uniqueDest(destDir, name, (p) => images.hasSource(p));
    await moveNoOverwrite(row.path, dest);
    try {
      images.relocate(row.id, { name: path.basename(dest), path: dest, dir: destDir });
    } catch (err) {
      // 记录更新失败：把文件搬回原处，图库和磁盘保持一致
      await moveNoOverwrite(dest, row.path).catch((e) => log.error("rollback failed:", dest, e));
      throw err;
    }
    return dest;
  }

  async function run(ids: number[], destDir: string): Promise<RunResult> {
    const { movable, managed, missing } = sortRows(ids);
    const result: RunResult = {
      entries: [],
      moved: 0,
      same: 0,
      managed: managed.length,
      missing: missing.length,
      failed: 0,
      error: "",
    };
    let lastSaid = 0;
    for (const [index, row] of movable.entries()) {
      if (row.dir === destDir || path.dirname(row.path) === destDir) {
        result.same++;
        continue;
      }
      if (Date.now() - lastSaid > 500) {
        lastSaid = Date.now();
        say(`正在移动 ${index + 1} / ${movable.length}…`);
      }
      try {
        const from = row.path;
        const to = await moveOne(row, destDir);
        result.entries.push({ id: row.id, from, to, dir: row.dir });
        result.moved++;
      } catch (err) {
        result.failed++;
        result.error ||= errorText(err);
        log.error("failed:", row.path, err);
      }
    }
    return result;
  }

  return {
    preview(ids) {
      const { movable, managed, missing } = sortRows(ids);
      return { movable: movable.length, managed: managed.length, missing: missing.length };
    },

    allowDir(dir) {
      chosenDir = dir;
    },

    move(ids, dir) {
      // 目标只能是图库里已有的文件夹，或刚刚选出来的文件夹，并且必须真实存在
      if (!(images.hasDir(dir) || dir === chosenDir) || !isDirectory(dir)) {
        return Promise.resolve({ ok: false, error: "目标文件夹不存在" });
      }
      const task = queue.then(async (): Promise<MoveResult> => {
        const { entries, ...result } = await run(ids, dir);
        const message = describe(result, dir);
        if (result.moved) {
          broadcast("library:changed");
          // 记下这次移动，界面的提示上有“撤销”按钮；只保留最近一次
          const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          lastMove = { token, entries };
          broadcast("library:move-done", { token, message });
        } else {
          say(message);
        }
        return { ok: true, ...result, message };
      });
      queue = task.catch(() => {});
      return task;
    },

    // 撤销最近一次移动：把文件搬回原来的文件夹、恢复原来的文件名。
    // 只处理“图库记录还指向移动后的位置、文件还在”的图片；原文件夹没了、记录被删了的会跳过，并说明
    undo(token) {
      if (!lastMove || lastMove.token !== token)
        return Promise.resolve({ ok: false, error: "这次移动已经无法撤销" });
      const { entries } = lastMove;
      lastMove = null; // 撤销只能做一次
      const task = queue.then(async (): Promise<UndoMoveResult> => {
        let restored = 0;
        let skipped = 0;
        let failed = 0;
        let error = "";
        for (const e of entries) {
          const [row] = images.imagesForMove([e.id]);
          if (!row || row.path !== e.to || !isRegularFile(e.to)) {
            skipped++; // 记录已删除 / 被移走 / 文件不在了
            continue;
          }
          if (!isDirectory(e.dir)) {
            failed++;
            error ||= "原来的文件夹已经不存在";
            continue;
          }
          try {
            await moveOne(row, e.dir, path.basename(e.from));
            restored++;
          } catch (err) {
            failed++;
            error ||= errorText(err);
            log.error("undo failed:", e.to, err);
          }
        }
        if (restored) broadcast("library:changed");
        const parts = [restored ? `已撤销，${restored} 张移回原来的文件夹` : "没有可撤销的图片"];
        if (skipped) parts.push(`${skipped} 张的位置已经变了，未处理`);
        if (failed) parts.push(`${failed} 张失败${error ? `（${error}）` : ""}`);
        const message = parts.join("，");
        say(message);
        return { ok: true, restored, skipped, failed, message };
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
