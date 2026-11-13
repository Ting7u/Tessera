# 迁移对照表（旧项目 → 新结构）

这是一次**结构重构**：功能和行为保持不变，只改变代码的组织方式和类型。本表记录旧文件去了哪里，
方便对照旧代码、审查行为是否一致。（重构完成后可保留作历史参考。）

## 行为必须保持不变的清单

重构者必须保证以下行为与旧版一致（旧代码就是规格）：

- SQLite 迁移 v1–v4 的 SQL 原文一字不改；`PRAGMA user_version` 机制不变；自定义 SQL 函数 `dirname` 在迁移前注册。
- IPC 通道名不变（`library:*`、`theme-changed`、`i18n:*`）。
- `tessera://` 协议的行为（thumb 用 basename 防路径穿越；original 按 id 查路径）。
- 导入：并发 3；SHA-1 去重；`pending` 哈希集合防并发重复；任务整体串行排队；每成功 20 张通知一次。
- 下载：`.part` 临时文件、`PART_RE`、登记/清理规则、`wx` 写入、三种 Referer 尝试顺序、超时 30 秒、单张 200MB。
- 浏览器扩展桥接：端口范围、Origin/Host 校验、令牌配对流程、`/ping` 返回 `{ app: "tessera" }`。
- 移动文件：绝不覆盖（硬链接 + 删除 / 复制 + 核对大小 + 删除）、撤销只保留最近一次且仅内存。
- 维护：先扫描后清理，清理前再核对一次；`probe()` 的 yes/no/unknown 三态。
- 所有安全校验（`toId`、`cleanTag`、路径校验、数量上限）。
- 文案与翻译键不变（locales 文件内容不变）。

**唯一有意的行为改动**（旧代码里的遗留 TODO）：

1. 下载进度类提示：主进程发 `{ text, downloading: true }`，渲染进程不再用中文开头正则猜“这是下载进度”
   （原 `Toast.jsx` 注释写明“第 3 步主进程改完后可以删掉”）。
2. 顶部栏的“排序”“布局”下拉菜单改用通用 `Menu`（视觉与右键菜单统一）。
3. 智能分类弹窗里的“仅收藏”开关改用通用 `Switch`。
4. `package.json` 里脚本路径 `scripts/check-i18n.js` 与实际目录 `script/` 不一致的问题已修正。
5. 浏览器扩展目录里误放的 `downloads.js`（主进程文件的调试副本，多一行 `console.log`）已删除，不属于扩展。

## 主进程

| 旧文件 | 新位置 |
| --- | --- |
| `electron/main.js` | 拆分：`main/index.ts`、`main/app/lifecycle.ts`、`main/app/window.ts`、`main/app/imageContextMenu.ts`、`main/app/ipc.ts`（主题/语言） |
| `electron/preload.js` | `preload/index.ts`（自动生成）+ `shared/ipc/spec.ts` |
| `electron/i18n.js` | `main/core/i18n/`（翻译逻辑已抽到 `shared/i18n/translate.ts`） |
| `electron/library/index.js` | `main/app/composition.ts`、`main/app/paths.ts` |
| `electron/library/constants.js` | `shared/constants.ts`（`IMAGE_EXTS`）+ `main/modules/importer/scanner.ts`（`isImage`） |
| `electron/library/schema.js` | `main/db/migrations/`（v1..v4 各一个文件 + `index.ts`） |
| `electron/library/store.js` | `main/db/`：`database.ts`、`repositories/{images,tags,smartAlbums,watchers}.ts`、`queries/*` |
| `electron/library/settings.js` | `main/core/settings/` |
| `electron/library/ipc.js` | 拆散到各模块的 `ipc.ts`：`images`、`importer`、`downloads`、`tags`、`smart-albums`；通知限流等 → `core/notify.ts` |
| `electron/library/importer.js` | `main/modules/importer/`（`importer.ts`、`hash.ts`、`copyIntoLibrary.ts`） |
| `electron/library/scanner.js` | `main/modules/importer/scanner.ts` |
| `electron/library/thumbnail.js` | `main/modules/thumbnails/` |
| `electron/library/exif.js` | `main/modules/exif/`（`normalize.ts` 纯函数 + `read.ts`） |
| `electron/library/backfill.js` | `main/modules/exif/backfill.ts` |
| `electron/library/watcher.js` | `main/modules/watcher/` |
| `electron/library/similar.js` | `main/modules/similar/`（`dhash.ts`、`grouping.ts` 纯函数、`finder.ts`） |
| `electron/library/downloader.js` | `main/modules/downloads/downloader.ts`、`filename.ts`（`pickName` 等纯函数） |
| `electron/library/downloads.js` | `main/modules/downloads/`（`downloads.ts` 服务、`partials.ts` 临时文件清理、`describeResult.ts`） |
| `electron/library/bridge.js` | `main/modules/bridge/` |
| `electron/library/folders.js` | `main/modules/folders/` |
| `electron/library/move.js` | `main/modules/move/` |
| `electron/library/maintenance.js` | `main/modules/maintenance/` |
| `electron/library/tags.js` | `main/modules/tags/` |
| `electron/library/protocol.js` | `main/modules/protocol/` |

## 渲染进程

| 旧文件 | 新位置 |
| --- | --- |
| `src/main.jsx`、`src/App.jsx` | `renderer/src/main.tsx`、`app/App.tsx` |
| `src/data.js`（模拟数据） | `renderer/src/dev/mockData.ts`，配合 `dev/mockApi.ts` |
| `src/store/useGalleryStore.js` | `store/`：`index.ts`、`slices/*`、`librarySync.ts`、`itemCache.ts` |
| `src/i18n/index.ts` | `shared/i18n/`（翻译核心用 `@shared/i18n`） |
| `src/types/electron.d.ts` | `renderer/src/env.d.ts` + `shared/ipc/spec.ts` 的 `TesseraApi` |
| `src/hooks/useDropImport.js` | `features/import/useDropImport.ts` |
| `src/hooks/useLibrarySync.js` | `store/librarySync.ts` + `app/App.tsx` |
| `src/hooks/useThemeEffect.js` | `app/useThemeEffect.ts` |
| `src/hooks/useFocusedItem.js` | `features/detail/useFocusedItem.ts` |
| `src/lib/layout.js` | `shared/lib/layout.ts`（排布引擎，纯）+ `shared/lib/layoutStorage.ts`（localStorage 读写） |
| `src/lib/{sort,tagColor,formatExif,toViewItem,pageTitle,dragTypes}.js` | `shared/lib/*.ts` |
| `src/components/Icon.jsx` | `shared/ui/Icon/` |
| `src/components/{Switch,Menu,Presence,Toast}/` | `shared/ui/{Switch,Menu,Presence,Toast}/` |
| `src/components/TitleBar/` | `features/titlebar/` |
| `src/components/Sidebar/Sidebar.jsx` | `features/sidebar/` |
| `src/components/Sidebar/{SmartDialog,RenameSmartDialog}.jsx` | `features/smart-albums/` |
| `src/components/TopBar/` | `features/topbar/` |
| `src/components/{Gallery,Tile,GalleryTitle,DuplicateNotice}/` | `features/gallery/` |
| `src/components/SelectionBar/` | `features/selection/` |
| `src/components/DetailPanel/` | `features/detail/` |
| `src/components/{ImportDialog,ImportProgress}/` | `features/import/` |
| `src/components/MoveDialog/` | `features/move/` |
| `src/components/TagDialog/` | `features/tags/` |
| `src/components/SettingsDialog/` | `features/settings/`（拆成 `sections/{Download,Maintenance,Language}Section.tsx`） |
| `src/styles/*` | `shared/styles/*` |
| `src/assets/icons/*.svg` | `shared/assets/icons/*.svg` |

## 复用整合（旧代码里重复实现的东西）

| 重复的东西 | 现在统一为 |
| --- | --- |
| 7 处“按 Esc 关闭弹窗”的 `useEffect` | `shared/hooks/useEscapeKey.ts` |
| 6 个弹窗各写一遍遮罩 + 面板 + 点外面关闭 | `shared/ui/Dialog/` |
| `RenameTagDialog` 与 `RenameSmartDialog`（几乎一样） | `shared/ui/RenameDialog/`，两个功能各传参数 |
| 侧边栏标签云与标签弹窗里各写一遍标签小圆角块 | `shared/ui/TagChip/` |
| `SortMenu` / `LayoutMenu` 手写下拉 | 通用 `Menu` + `useMenu` |
| 智能分类弹窗手写开关 | 通用 `Switch` |
| 主进程 `toId` / `cleanTag` / `isDirectory` / `isRegularFile` 在多个文件各写一遍 | `core/sanitize.ts`、`core/fsUtils.ts` |
| 主进程 `i18n.js` 与渲染进程 `i18n/index.ts` 两份 `translate` | `shared/i18n/translate.ts` |
| `thumbsDir()` / `libraryDir()` 在 folders.js 里重复推导（注释写“要和 index.js 一致”） | `main/app/paths.ts` 唯一出处，注入使用 |
| `Store` 巨型类 | 4 个 Repository + 纯 SQL 构建函数 |
| `useGalleryStore` 巨型 store | 按领域拆成 slice |
