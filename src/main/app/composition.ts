// 组装根（composition root）：整个主进程唯一“知道所有模块”的地方。
// 读它就能看懂启动流程：打开数据库 → 创建 Repository → 创建各模块 → 把互相需要的依赖传进去
// → 注册 IPC → 恢复监听 → 安排后台任务。
// 模块之间不直接 import 对方，需要协作都在这里通过参数传入。
import fs from "node:fs";
import { app } from "electron";
import { createChangedNotifier, createNotifier, createProgressEmitter } from "../core/notify";
import { createLogger } from "../core/logger";
import { createSettings } from "../core/settings";
import type { AppPaths } from "../core/paths";
import { openDatabase } from "../db/database";
import { importLegacyJson } from "../db/legacyJson";
import {
  createImagesRepository,
  createSmartAlbumsRepository,
  createTagsRepository,
  createWatchersRepository,
} from "../db/repositories";
import { createBridge } from "../modules/bridge";
import { createDownloads, describeResult, registerDownloadsIpc } from "../modules/downloads";
import { createBackfill, readExif } from "../modules/exif";
import { createFolders, registerFoldersIpc } from "../modules/folders";
import { registerImagesIpc } from "../modules/images";
import { createImporter, registerImporterIpc } from "../modules/importer";
import { createMaintenance, registerMaintenanceIpc } from "../modules/maintenance";
import { createMover, registerMoveIpc } from "../modules/move";
import { registerHandler as registerProtocolHandler } from "../modules/protocol";
import { registerSmartAlbumsIpc } from "../modules/smart-albums";
import { createSimilarFinder } from "../modules/similar";
import { registerTagsIpc } from "../modules/tags";
import { createThumbnail, deleteThumbs } from "../modules/thumbnails";
import { createWatcher } from "../modules/watcher";

const log = createLogger("library");

const SIMILAR_QUIET_MS = 5000; // 图库变化后安静这么久再算相似图，导入过程中不会反复触发
const BACKFILL_DELAY_MS = 3000; // 启动后延迟补读 EXIF，避开启动高峰

export interface Library {
  /** 按图片 id 查原图的磁盘路径；找不到返回 null（右键菜单、协议处理都用它） */
  getImagePath(id: number): string | null;
}

/** 需在 app ready 之后调用 */
export function composeLibrary(paths: AppPaths): Library {
  // ---------- 数据层 ----------
  const database = openDatabase(paths.db);
  const tags = createTagsRepository(database);
  const smartAlbums = createSmartAlbumsRepository(database);
  const watchers = createWatchersRepository(database);
  const images = createImagesRepository(database, tags, smartAlbums);
  importLegacyJson(database, images, watchers, paths.legacyJson);

  const settings = createSettings(paths.settings); // 下载文件夹等用户设置
  const notifyChanged = createChangedNotifier();

  // ---------- 相似图片 ----------
  // 图库变化后安静 5 秒再算一次；分组有变化时用 notifyChanged（而不是 onChanged）通知界面，避免互相触发
  const similar = createSimilarFinder({ images, thumbsDir: paths.thumbs });
  let similarTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSimilar = (): void => {
    if (similarTimer) clearTimeout(similarTimer);
    similarTimer = setTimeout(() => {
      similar
        .run()
        .then((changed) => {
          if (changed) notifyChanged();
        })
        .catch((err) => log.error("similar:", err));
    }, SIMILAR_QUIET_MS);
  };
  const onChanged = (): void => {
    notifyChanged();
    scheduleSimilar();
  };

  // ---------- 导入 / 监听 ----------
  const importer = createImporter({
    images,
    dirs: { thumbs: paths.thumbs, library: paths.library },
    emit: createProgressEmitter(),
    onChanged,
    readExif,
    createThumbnail,
  });
  const watcher = createWatcher({
    onFiles: (files, mode) => {
      // 已入库的文件（比如刚下载并导入的）不再重复导入，避免弹出“跳过重复”的进度提示
      const fresh = files.filter((file) => !images.hasSource(file));
      if (fresh.length) void importer.enqueueImport(fresh, { mode });
    },
  });

  // ---------- 下载 / 浏览器扩展 ----------
  // 拖拽（ipc）和浏览器扩展（bridge）共用 downloads；ui.activeFilter 由界面同步过来
  const ui = { activeFilter: "all" };
  const downloads = createDownloads({ images, importer, settings });
  const bridge = createBridge({
    settings,
    downloads,
    ui,
    notify: createNotifier(),
    describeResult,
  });

  // ---------- 其他功能模块 ----------
  const deleteOwnThumbs = (rows: { thumb: string | null }[]): Promise<void> =>
    deleteThumbs(paths.thumbs, rows);
  const folders = createFolders({
    images,
    watchers,
    watcher,
    libraryDir: paths.library,
    deleteThumbs: deleteOwnThumbs,
  });
  const mover = createMover({ images });
  const maintenance = createMaintenance({ images, deleteThumbs: deleteOwnThumbs });

  // ---------- 协议 + IPC ----------
  const getImagePath = (id: number): string | null => images.getPath(id);
  registerProtocolHandler({ thumbsDir: paths.thumbs, getPathById: getImagePath });
  registerImagesIpc({ images });
  registerImporterIpc({
    importer,
    watchers,
    watchDir: (dir, mode) => watcher.watch(dir, mode),
    settings,
  });
  registerDownloadsIpc({ downloads, ui });
  registerTagsIpc({ tags });
  registerSmartAlbumsIpc({ smartAlbums, tags });
  registerFoldersIpc({ folders });
  registerMoveIpc({ mover });
  registerMaintenanceIpc({ maintenance });
  bridge.start().catch((err) => log.error("bridge:", err)); // 本机接口：只给浏览器扩展用

  // ---------- 启动后的后台任务 ----------
  // 恢复监听；应用没开着时新增的图片，启动时静默补扫一次（已导入的按路径跳过，不会重复算哈希）
  for (const w of watchers.all()) {
    if (!fs.existsSync(w.path)) continue;
    watcher.watch(w.path, w.mode);
    void importer.enqueueImport([w.path], { mode: w.mode, silent: true });
  }

  // 升级前导入的图片：启动 3 秒后在后台补读 EXIF
  const backfill = createBackfill({ images, readExif, onChanged });
  setTimeout(
    () => backfill.run().catch((err) => log.error("exif backfill:", err)),
    BACKFILL_DELAY_MS,
  );

  // 已有图片也要算相似分组（首次升级后，或上次退出前还没算完）
  scheduleSimilar();

  app.on("before-quit", () => {
    if (similarTimer) clearTimeout(similarTimer);
    bridge.stop();
    downloads.shutdown();
    watcher.closeAll();
    database.close();
  });

  return { getImagePath };
}
