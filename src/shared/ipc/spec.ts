// window.api 的结构说明书：把“界面上调用的名字”绑定到“IPC 通道”。
// preload 按它自动生成 window.api；渲染进程按它的类型获得完整的代码提示。
// 新增接口：先在 contract.ts 声明通道，再在这里加一行。
import type { DesktopPlatform } from "../types";
import type { I18nState } from "../i18n/languages";
import type {
  EventChannel,
  EventMap,
  InvokeChannel,
  InvokeMap,
  SendChannel,
  SendMap,
} from "./contract";

// ---------- 绑定描述符 ----------
export interface InvokeBinding<C extends InvokeChannel = InvokeChannel> {
  readonly kind: "invoke";
  readonly channel: C;
}
export interface SendBinding<C extends SendChannel = SendChannel> {
  readonly kind: "send";
  readonly channel: C;
}
export interface EventBinding<C extends EventChannel = EventChannel> {
  readonly kind: "event";
  readonly channel: C;
}
export type Binding = InvokeBinding | SendBinding | EventBinding;
export interface SpecGroup {
  readonly [name: string]: Binding;
}
export interface Spec {
  readonly [group: string]: SpecGroup;
}

/** 调用主进程并等待结果 */
export const invoke = <C extends InvokeChannel>(channel: C): InvokeBinding<C> => ({
  kind: "invoke",
  channel,
});
/** 通知主进程，不等结果 */
export const send = <C extends SendChannel>(channel: C): SendBinding<C> => ({
  kind: "send",
  channel,
});
/** 订阅主进程的推送，调用后返回“取消订阅”函数 */
export const on = <C extends EventChannel>(channel: C): EventBinding<C> => ({
  kind: "event",
  channel,
});

// ---------- 说明书本体 ----------
export const apiSpec = {
  app: {
    setTheme: send("theme-changed"),
    onNotice: on("library:notice"),
  },
  i18n: {
    setPreference: send("i18n:set"),
    onChange: on("i18n:changed"),
  },
  library: {
    list: invoke("library:list"),
    stats: invoke("library:stats"),
    sidebar: invoke("library:sidebar"),
    setActive: invoke("library:set-active"),
    onChanged: on("library:changed"),
  },
  images: {
    open: invoke("library:open"),
    reveal: invoke("library:reveal"),
    copyImage: invoke("library:copy-image"),
    moreMenu: invoke("library:more-menu"),
    setFavorite: invoke("library:set-favorite"),
    fileExists: invoke("library:file-exists"),
  },
  importer: {
    import: invoke("library:import"),
    importPaths: invoke("library:import-paths"),
    getImportMode: invoke("library:get-import-mode"),
    onProgress: on("library:progress"),
  },
  downloads: {
    download: invoke("library:download"),
    cancel: invoke("library:cancel-downloads"),
    getDir: invoke("library:get-download-dir"),
    chooseDir: invoke("library:choose-download-dir"),
  },
  tags: {
    addTag: invoke("library:add-tag"),
    addTagToMany: invoke("library:add-tag-many"),
    removeTagFromMany: invoke("library:remove-tag-many"),
    removeTag: invoke("library:remove-tag"),
    menu: invoke("library:tag-menu"),
    rename: invoke("library:tag-rename"),
    onRenameRequest: on("library:tag-rename-request"),
    onRemoved: on("library:tag-removed"),
  },
  smart: {
    create: invoke("library:smart-create"),
    remove: invoke("library:smart-delete"),
    menu: invoke("library:smart-menu"),
    rename: invoke("library:smart-rename"),
    onRenameRequest: on("library:smart-rename-request"),
    onRemoved: on("library:smart-removed"),
  },
  folders: {
    menu: invoke("library:folder-menu"),
    onRemoved: on("library:folder-removed"),
  },
  move: {
    preview: invoke("library:move-preview"),
    choose: invoke("library:move-choose"),
    move: invoke("library:move"),
    undo: invoke("library:undo-move"),
    onDone: on("library:move-done"),
  },
  maintenance: {
    scanMissing: invoke("library:scan-missing"),
    cleanMissing: invoke("library:clean-missing"),
  },
} as const satisfies Spec;

// ---------- 由说明书推导出 window.api 的类型 ----------
type ApiGroup<G> = {
  [K in keyof G]: G[K] extends { kind: "invoke"; channel: infer C extends InvokeChannel }
    ? (...args: Parameters<InvokeMap[C]>) => Promise<ReturnType<InvokeMap[C]>>
    : G[K] extends { kind: "send"; channel: infer C extends SendChannel }
      ? (...args: Parameters<SendMap[C]>) => void
      : G[K] extends { kind: "event"; channel: infer C extends EventChannel }
        ? (callback: (payload: EventMap[C]) => void) => () => void
        : never;
};

/** 只能在 preload 里实现的部分（用到 Node / Electron 渲染端专有接口），不走 IPC 说明书 */
export interface PreloadExtras {
  app: {
    /** 'win32' | 'darwin' | 'linux'，界面据此调整标题栏留白 */
    platform: DesktopPlatform;
  };
  i18n: {
    /** 页面加载前同步取到的初始语言状态（第一帧就是对的语言） */
    initial: I18nState;
  };
  importer: {
    /** 拖拽导入：新版 Electron 的 File 对象没有 .path，必须用 webUtils 取真实路径 */
    getPathForFile: (file: Blob) => string;
  };
}

export type TesseraApi = {
  [G in keyof typeof apiSpec]: ApiGroup<(typeof apiSpec)[G]>;
} & PreloadExtras;
