// 半成品（.part）清理。正在写的临时文件登记在内存和 settings 里：正常退出时立刻删；
// 万一进程被强杀，下次启动再删。
// 删除的安全规则（宁可留下垃圾，也不能误删用户的文件），全部满足才会删：
//   1. 路径是我们自己登记过的（不扫描目录，不按通配符找文件）
//   2. 文件名严格符合我们生成的格式：.<13位时间戳>-<随机串>.part
//   3. 是普通文件，不是快捷方式 / 符号链接
//   4. 文件最后修改时间不早于我们登记它的时间（登记之前就存在的文件，一定不是我们写的）
import fs from "node:fs";
import path from "node:path";
import type { PartialEntry, Settings } from "../../core/settings";
import type { PartialTracker } from "./downloader";

export const PART_RE = /^\.\d{13}-[a-z0-9]+\.part$/;

/**
 * 处理一批登记。返回已处理（删掉、不存在、或确认不是我们的）的条目；
 * 删不掉的（例如 Windows 上仍被占用）不返回，留着下次再试
 */
export function sweepPartials(entries: unknown[]): unknown[] {
  const handled: unknown[] = [];
  for (const entry of entries) {
    const e = entry as Partial<PartialEntry> | null | undefined;
    const p = e?.p;
    const t = Number(e?.t);
    if (
      typeof p !== "string" ||
      !path.isAbsolute(p) ||
      !Number.isFinite(t) ||
      !PART_RE.test(path.basename(p))
    ) {
      handled.push(entry); // 格式不对的记录：丢弃，不碰任何文件
      continue;
    }
    try {
      const st = fs.lstatSync(p);
      if (st.isFile() && !st.isSymbolicLink() && st.mtimeMs >= t - 2000) fs.unlinkSync(p);
      handled.push(entry); // 不是我们写的（或已经删掉了）：不动它，只是不再记录
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") handled.push(entry);
      // 其他错误（占用、权限）：保留记录，下次再试
    }
  }
  return handled;
}

export interface Partials {
  tracker: PartialTracker;
  /** 退出时调用：立即清理当前登记的临时文件 */
  sweepNow(): void;
}

/** 创建登记器，并顺带清理上次遗留的 .part */
export function createPartials(settings: Settings): Partials {
  const partials = new Map<string, number>(); // 路径 → 登记时间
  const snapshot = (): PartialEntry[] => [...partials].map(([p, t]) => ({ p, t }));
  const persist = (): void => {
    try {
      settings.set("partials", snapshot());
    } catch {
      /* 忽略 */
    }
  };

  const leftover = settings.get("partials");
  if (Array.isArray(leftover) && leftover.length) {
    const handled = new Set(sweepPartials(leftover));
    settings.set(
      "partials",
      leftover.filter((e) => !handled.has(e)),
    );
  }

  return {
    tracker: {
      add(p) {
        partials.set(p, Date.now());
        persist();
      },
      remove(p) {
        if (partials.delete(p)) persist();
      },
    },
    sweepNow() {
      sweepPartials(snapshot()); // Windows 上文件可能还被占用而删不掉，记录保留，下次启动再删
    },
  };
}
