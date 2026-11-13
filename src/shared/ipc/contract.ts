// IPC 契约：渲染进程 ⇄ 主进程所有通信的“唯一真相”。
// 加一个接口只需要：① 在这里声明通道和类型 ② 在 spec.ts 里加一行绑定 ③ 在主进程模块里 handle(...) 实现。
// preload 不用改（它按 spec 自动生成）。详见 docs/ipc.md。
//
// 通道名沿用 "<域>:<动作>" 的写法。
import type { I18nState, LanguagePreference } from "../i18n/languages";
import type {
  ActionResult,
  CleanMissingKind,
  CleanMissingResult,
  CopyImageResult,
  DownloadRequest,
  DownloadResult,
  ImageRecord,
  ImportMode,
  ImportProgress,
  ImportRequest,
  LibraryStats,
  ListParams,
  ListResult,
  MoveChooseResult,
  MoveDonePayload,
  MovePreview,
  MoveRequest,
  MoveResult,
  Notice,
  ScanMissingResult,
  SidebarData,
  SmartCreateResult,
  SmartRenameResult,
  SmartRule,
  TagChange,
  TagRenameResult,
  ThemeName,
  UndoMoveResult,
} from "../types";

/** 渲染进程 → 主进程，有返回值（ipcRenderer.invoke / ipcMain.handle）。函数的返回类型就是结果类型（不用写 Promise） */
export interface InvokeMap {
  // 图库列表
  "library:list": (params: ListParams) => ListResult<ImageRecord>;
  "library:stats": () => LibraryStats;
  "library:sidebar": () => SidebarData;
  "library:set-active": (filter: string) => boolean;

  // 单张图片
  "library:open": (id: number) => ActionResult;
  "library:reveal": (id: number) => ActionResult;
  "library:copy-image": (id: number) => CopyImageResult;
  "library:more-menu": (id: number) => ActionResult;
  "library:set-favorite": (id: number, value: boolean) => boolean;
  "library:file-exists": (id: number) => boolean;

  // 导入
  "library:import": (request: ImportRequest) => { canceled: boolean };
  "library:import-paths": (paths: string[]) => { count: number };
  "library:get-import-mode": () => ImportMode;

  // 下载
  "library:download": (request: DownloadRequest) => DownloadResult;
  "library:cancel-downloads": () => boolean;
  "library:get-download-dir": () => string | null;
  "library:choose-download-dir": () => string | null;

  // 标签
  "library:add-tag": (id: number, name: string) => string[] | null;
  "library:add-tag-many": (ids: number[], name: string) => TagChange[] | null;
  "library:remove-tag-many": (ids: number[], name: string) => TagChange[] | null;
  "library:remove-tag": (id: number, name: string) => string[] | null;
  "library:tag-menu": (name: string) => { ok: boolean };
  "library:tag-rename": (from: string, to: string) => TagRenameResult;

  // 智能分类
  "library:smart-create": (name: string, rule: Partial<SmartRule>) => SmartCreateResult;
  "library:smart-delete": (id: number) => boolean;
  "library:smart-menu": (id: number, name: string) => { ok: boolean };
  "library:smart-rename": (id: number, name: string) => SmartRenameResult;

  // 文件夹
  "library:folder-menu": (dir: string) => { ok: boolean };

  // 移动
  "library:move-preview": (ids: number[]) => MovePreview;
  "library:move-choose": () => MoveChooseResult;
  "library:move": (request: MoveRequest) => MoveResult;
  "library:undo-move": (token: string) => UndoMoveResult;

  // 维护
  "library:scan-missing": () => ScanMissingResult;
  "library:clean-missing": (kind: CleanMissingKind) => CleanMissingResult;
}

/** 渲染进程 → 主进程，不等结果（ipcRenderer.send / ipcMain.on） */
export interface SendMap {
  "theme-changed": (theme: ThemeName) => void;
  "i18n:set": (preference: LanguagePreference) => void;
}

/** 渲染进程 → 主进程，同步取值（ipcRenderer.sendSync）。只用于页面加载前必须拿到的初始值 */
export interface SyncMap {
  "i18n:get": () => I18nState;
}

/** 主进程 → 渲染进程的推送：通道 → 载荷类型（无载荷写 void） */
export interface EventMap {
  "library:changed": void;
  "library:progress": ImportProgress;
  "library:notice": Notice;
  "library:move-done": MoveDonePayload;
  "library:folder-removed": string;
  "library:tag-rename-request": string;
  "library:tag-removed": string;
  "library:smart-removed": number;
  "library:smart-rename-request": { id: number; name: string };
  "i18n:changed": I18nState;
}

export type InvokeChannel = keyof InvokeMap;
export type SendChannel = keyof SendMap;
export type SyncChannel = keyof SyncMap;
export type EventChannel = keyof EventMap;

export type InvokeArgs<C extends InvokeChannel> = Parameters<InvokeMap[C]>;
export type InvokeResult<C extends InvokeChannel> = ReturnType<InvokeMap[C]>;
export type SendArgs<C extends SendChannel> = Parameters<SendMap[C]>;

/** broadcast 的载荷参数：载荷为 void 的事件不用传 */
export type EventPayloadArgs<E extends EventChannel> = EventMap[E] extends void
  ? []
  : [payload: EventMap[E]];
