# 架构总览

Tessera（拾影）是一个 Electron 桌面应用：用 SQLite 记录本地图片，生成缩略图，支持标签、智能分类、相似图片检测、
监听文件夹自动导入、拖拽/浏览器扩展下载网页图片。

本文回答三个问题：**代码分几块、每块管什么、块与块之间怎么通信**。
想知道“某个文件在哪”请看 [project-structure.md](./project-structure.md)；想知道“怎么加功能”请看 [recipes.md](./recipes.md)。

## 1. 三个进程 + 一个共享层

```
┌──────────────────────────────┐          ┌───────────────────────────┐
│  renderer（界面，React）      │          │  main（主进程，Node）      │
│  src/renderer                │          │  src/main                 │
│  - 只负责显示和交互           │  window  │  - 数据库、文件系统、      │
│  - 不碰文件、不碰数据库       │  .api    │    下载、系统对话框、菜单   │
│  - 通过 window.api 调主进程   │◄────────►│  - 所有“有副作用”的事      │
└──────────────┬───────────────┘   IPC    └─────────────┬─────────────┘
               │            ┌──────────────┐            │
               └───────────►│ preload      │◄───────────┘
                            │ src/preload  │  （把 IPC 包装成 window.api，
                            └──────┬───────┘   只做转发，没有业务逻辑）
                                   │
                  所有进程共同依赖 ▼
                       ┌──────────────────────┐
                       │ shared  src/shared   │ 只放：类型、常量、纯函数
                       │ IPC 契约 / 领域类型    │ 不能 import electron / node / react
                       │ 多语言翻译 / 协议地址   │
                       └──────────────────────┘
```

依赖方向（**单向**，由 `npm run check:boundaries` 强制检查）：

| 目录 | 可以依赖 | 不可以依赖 |
| --- | --- | --- |
| `src/shared` | 无（只有自己） | electron、node 内置模块、react、main、renderer、preload |
| `src/preload` | electron、shared | main、renderer |
| `src/main` | electron、node、第三方原生库、shared | renderer、react、zustand |
| `src/renderer` | react、zustand、shared | electron、node 内置模块、main、better-sqlite3、sharp |

## 2. IPC：唯一的跨进程通道

渲染进程和主进程**只**通过 IPC 通信，契约集中在 `src/shared/ipc/`：

- `contract.ts`：每个通道的参数和返回值类型（`InvokeMap` 请求/响应，`SendMap` 单向通知，`EventMap` 主进程推送）。
- `spec.ts`：把界面里的调用名（`window.api.tags.rename`）绑定到通道（`library:tag-rename`）。
- `src/preload/index.ts`：按 `spec.ts` 自动生成 `window.api`，**加接口不用改它**。
- `src/main/core/ipc/registry.ts`：主进程用 `handle()` / `broadcast()` 注册和推送，类型由契约约束。

安全原则（沿用原项目，重构时不能破坏）：

1. **渲染进程传来的一切参数都不可信**。主进程处理函数必须自己校验、收敛范围（`src/main/core/sanitize.ts`）。
2. 渲染进程**只传 id 和选项，不传文件路径**；真实路径永远由主进程从数据库查或用系统对话框得到。
   少数例外（拖拽导入的路径）必须逐条校验是否为绝对路径、是否存在、是否为受支持的图片或文件夹。
3. 永远不删除用户的原文件；只删除 Tessera 自己生成的缩略图；托管副本只在用户明确勾选时才移到回收站。

详细步骤见 [ipc.md](./ipc.md)。

## 3. 主进程（src/main）

分四层，上层可以用下层，下层不能反过来用上层：

```
app/        装配层：窗口、生命周期、依赖注入（composition root）
modules/    功能模块：一个功能一个目录（导入、下载、标签、移动……）
db/         数据层：数据库连接、迁移、各类 Repository
core/       基础设施：IPC 注册、设置存储、多语言、日志、校验、文件工具
```

### 3.1 功能模块（modules/）的约定

每个模块是一个目录，对外只暴露 `index.ts`：

```
modules/<name>/
  index.ts        公开 API：create<Name>() 工厂、需要被别人用的类型、register<Name>Ipc()
  ipc.ts          只做“接收参数 → 校验 → 调服务 → 返回”，不写业务
  <service>.ts    业务逻辑（可以有多个文件）
  *.test.ts       纯逻辑的单元测试（与被测文件放在一起）
```

- **模块之间不直接 import 对方的内部文件**。需要协作时，由 `app/composition.ts` 创建实例，
  再通过参数传入（依赖注入）。原项目已经是工厂函数 + 参数传依赖的风格（`createImporter({ store, dirs, ... })`），保持它。
- 纯逻辑和 Electron 相关代码分开放：能不 import electron 就不 import，这样才能写单元测试
  （例如 `exif/normalize.ts`、`similar/grouping.ts`、`downloads/filename.ts` 都是纯文件）。
- 用到 `ipcMain` 的地方一律改用 `core/ipc` 的 `handle()`；弹原生菜单 / 对话框的代码放在模块里，不放在 ipc.ts 里。

### 3.2 数据层（db/）

原来的 `Store` 类有 535 行，同时管图片、标签、智能分类、监听、相似图片、EXIF……现在按“聚合”拆成 Repository：

- `images` — 图片的增删改查、列表分页、相似分组、EXIF 补读、文件夹统计
- `tags` — 标签的增删改、合并、重命名
- `smartAlbums` — 智能分类及其规则
- `watchers` — 被监听的文件夹
- `queries/` — **纯函数**：把“侧边栏 filter / 智能分类规则 / 排序 / 搜索词”翻译成 SQL 片段（可单元测试）
- `migrations/` — 数据库迁移。**只追加，永远不修改已发布的迁移**（见 [data-model.md](./data-model.md)）

Repository 只返回数据，不弹窗、不发通知、不碰文件。

### 3.3 装配层（app/）

`app/composition.ts` 是整个主进程唯一“知道所有模块”的地方：创建数据库 → 创建 Repository → 创建各模块 →
把它们互相需要的依赖传进去 → 注册 IPC → 恢复监听 → 安排后台任务。读它就能看懂整个主进程的启动流程。

## 4. 渲染进程（src/renderer/src）

```
app/        根组件 App、全局副作用（主题、与主进程同步）
features/   功能目录：一个功能一个目录，自带组件、样式、局部 hook
shared/     跨功能复用：ui 组件库、通用 hook、纯函数 lib、i18n、api、样式、图标
store/      全局状态（zustand，按领域拆成 slice）
dev/        浏览器单独调试用的模拟 API（没有 Electron 时自动启用）
```

依赖方向：`features → store → shared`，`app → 一切`。

- **features 之间不互相 import 内部文件**。一个 feature 只通过自己的 `index.ts` 暴露给别人用。
  需要共享的东西，要么下沉到 `shared/`，要么通过 store 通信。
- **shared 和 store 不能 import features**。
- 组件里不直接写 `window.api`，统一用 `shared/api` 导出的 `api`（类型完整，浏览器调试时自动换成模拟实现）。
- 组件里所有用户可见文字都用 `useT()` 取，不写死中文或英文（见 [conventions.md](./conventions.md)）。

### 4.1 全局状态（store/）

只有**跨组件共享**的状态才放 store；弹窗内部的输入框内容、是否忙碌之类的局部状态用 `useState`。

store 按领域拆成 slice（`store/slices/*.ts`），再在 `store/index.ts` 合成一个 `useAppStore`：

| slice | 管什么 |
| --- | --- |
| `gallery` | 当前分类、搜索词、排序、布局、已加载图片、分页、总数 |
| `sidebar` | 侧边栏数据（计数、文件夹、标签、智能分类） |
| `selection` | 已选图片 |
| `detail` | 详情面板（打开哪张、上一张/下一张） |
| `dialogs` | 各弹窗的开关和参数 |
| `toast` | 提示条 |
| `theme` | 深色 / 浅色 |
| `importProgress` | 导入进度 |
| `tags` `smart` `favorites` `downloads` `move` | 各自的“调用主进程 + 同步本地状态”的操作 |

slice 之间需要互相调用时用 `get()`（例如 `selectCategory` 里调 `reload`），不要 import 对方的运行时代码。
与主进程的事件订阅集中在 `store/librarySync.ts`。

## 5. 数据与文件放在哪（运行时）

都在 Electron 的 `userData` 目录下（Windows：`%APPDATA%\Tessera`）。**目录名由 package.json 的 `productName` 决定，不要改名。**

| 路径 | 内容 |
| --- | --- |
| `library.db` | SQLite 数据库（WAL 模式） |
| `thumbs/<sha1>.jpg` | 缩略图，文件名 = 图片内容的 SHA-1 |
| `library/<YYYY-MM>/` | “复制到图库托管”模式下的图片副本 |
| `settings.json` | 用户设置（入库方式、下载文件夹、浏览器扩展令牌、未清理的 .part 文件记录） |
| `language.json` | 语言偏好（单独存放，启动时图库还没初始化就要读） |

## 6. 自定义协议

`tessera://thumb/<hash>.jpg` 和 `tessera://original/<id>` 由主进程的 `modules/protocol` 处理；
地址的拼法在 `src/shared/protocol.ts`，主进程和渲染进程共用。

## 7. 浏览器扩展

`extensions/browser/` 是独立的 Chrome/Edge 扩展，通过本机 HTTP 接口（`127.0.0.1`，端口 38765–38774）和主进程的
`modules/bridge` 通信。协议和安全设计见 [browser-extension.md](./browser-extension.md)。它**不属于** `src` 的构建，
有自己的版本号。

## 8. 为什么这样设计

关键决策记录在 [decisions/](./decisions/)：

- [0001 使用 electron-vite 并全面 TypeScript 化](./decisions/0001-electron-vite-typescript.md)
- [0002 类型化 IPC 契约](./decisions/0002-typed-ipc-contract.md)
- [0003 按功能模块组织，依赖边界由脚本检查](./decisions/0003-feature-modules-and-boundaries.md)
- [0004 保持产品名与用户数据目录不变](./decisions/0004-keep-product-name.md)
