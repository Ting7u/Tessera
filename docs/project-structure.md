# 目录结构

“这个东西应该放哪”的速查。架构原则见 [architecture.md](./architecture.md)。

```
tessera/
├─ AGENTS.md                  AI 协作者入口（CLAUDE.md 指向它）
├─ README.md                  项目入口
├─ CONTRIBUTING.md            贡献流程
├─ CHANGELOG.md
├─ package.json               脚本与依赖
├─ electron.vite.config.ts    构建配置（main / preload / renderer 三个目标）
├─ electron-builder.yml       打包配置
├─ tsconfig.json              Node 侧类型检查（main / preload / shared / 测试）
├─ build/                     安装包图标（electron-builder 用）
├─ resources/                 运行时资源（Linux 窗口图标）
├─ docs/                      文档（你正在看的）
├─ scripts/                   工程检查脚本（i18n、依赖边界、IPC 完整性）
├─ extensions/browser/        浏览器扩展（独立项目，不参与 src 的构建）
└─ src/
   ├─ shared/                 三个进程共用：类型、常量、纯函数
   │  ├─ constants.ts         软件名、支持的图片扩展名、桥接端口
   │  ├─ protocol.ts          tessera:// 地址的拼法
   │  ├─ types/               领域类型（图片、图库、导入下载、移动维护）
   │  ├─ ipc/                 IPC 契约：contract.ts（类型）+ spec.ts（window.api 结构）
   │  └─ i18n/                翻译核心 translate.ts + locales/{zh,en}.json
   ├─ preload/index.ts        按 spec 生成 window.api（只转发）
   ├─ main/                   主进程
   │  ├─ index.ts             入口，只调用 app/
   │  ├─ app/                 装配层
   │  │  ├─ lifecycle.ts      单实例、AppUserModelId、ready/activate/window-all-closed
   │  │  ├─ window.ts         创建主窗口、标题栏主题
   │  │  ├─ imageContextMenu.ts  详情大图的原生右键菜单
   │  │  ├─ paths.ts          所有磁盘路径的唯一出处
   │  │  ├─ ipc.ts            属于 app 层的 IPC：主题切换、语言
   │  │  └─ composition.ts    创建并连接所有模块（读它就懂启动流程）
   │  ├─ core/                基础设施（不含业务）
   │  │  ├─ ipc/              handle / onSend / onSync / broadcast
   │  │  ├─ settings/         settings.json 读写（带类型的键）
   │  │  ├─ i18n/             主进程的 t()、语言偏好持久化
   │  │  ├─ logger.ts         createLogger("scope")
   │  │  ├─ sanitize.ts       toId / cleanTag / cleanIds 等入参收敛
   │  │  ├─ fsUtils.ts        isDirectory / isRegularFile / isInside / probe ...
   │  │  └─ notify.ts         进度限流、变更通知限流、一句话提示 + 系统通知
   │  ├─ db/                  数据层
   │  │  ├─ database.ts       打开连接 + pragma + 自定义 SQL 函数
   │  │  ├─ migrations/       v1..v4，只追加
   │  │  ├─ queries/          纯函数：filter / 智能规则 / 排序 / 搜索 → SQL
   │  │  └─ repositories/     images / tags / smartAlbums / watchers
   │  └─ modules/             功能模块（每个都是 index.ts + ipc.ts + 服务文件）
   │     ├─ images/           打开、定位、复制图片、收藏、更多菜单、文件是否存在
   │     ├─ importer/         导入队列、哈希、复制托管、扫描文件夹
   │     ├─ thumbnails/       缩略图生成（nativeImage / 系统缩略图 / sharp）
   │     ├─ exif/             EXIF 解析（纯）+ 后台补读
   │     ├─ watcher/          chokidar 监听文件夹
   │     ├─ similar/          相似图片：dHash、分组（纯）、后台任务
   │     ├─ downloads/        下载服务、单文件下载、.part 清理、文件名规则
   │     ├─ bridge/           给浏览器扩展用的本机 HTTP 接口
   │     ├─ tags/             标签菜单、重命名、删除、批量
   │     ├─ smart-albums/     智能分类的创建、重命名、删除、菜单
   │     ├─ folders/          文件夹菜单、开始/停止监听、从图库移除
   │     ├─ move/             移动文件（不覆盖）、撤销
   │     ├─ maintenance/      扫描并清理已丢失的图片
   │     └─ protocol/         tessera:// 协议
   └─ renderer/               渲染进程
      ├─ index.html
      ├─ tsconfig.json        渲染进程类型检查（有 DOM）
      └─ src/
         ├─ main.tsx          入口
         ├─ env.d.ts          window.api 的全局类型
         ├─ app/              根组件 App、全局副作用
         ├─ store/            全局状态（slices/ + index.ts + librarySync.ts）
         ├─ features/         功能（每个目录有 index.ts 作为公开入口）
         │  ├─ titlebar/ sidebar/ topbar/ gallery/ selection/
         │  ├─ detail/ import/ move/ tags/ smart-albums/ settings/
         ├─ shared/
         │  ├─ ui/            通用组件：Icon Switch Menu Presence Toast Dialog TagChip …
         │  ├─ hooks/         通用 hook：useEscapeKey …
         │  ├─ lib/           纯函数：layout sort tagColor formatExif toViewItem pageTitle dragTypes
         │  ├─ i18n/          useT / t / 语言状态
         │  ├─ api/           api 入口（真实 window.api 或模拟实现）
         │  ├─ styles/        theme / base / mixins
         │  └─ assets/icons/  *.svg 图标
         └─ dev/              浏览器单独调试用的模拟 API 与模拟数据
```

## “我要改 X，该看哪里？”

| 需求 | 位置 |
| --- | --- |
| 改导入逻辑（哈希、去重、复制） | `main/modules/importer/` |
| 改缩略图大小/质量 | `main/modules/thumbnails/` |
| 改图片列表的排序/搜索/分页 SQL | `main/db/queries/`、`main/db/repositories/images.ts` |
| 加数据库字段 | `main/db/migrations/`（追加新迁移）+ `shared/types/image.ts` + 对应 Repository |
| 改下载保存位置规则 | `main/modules/downloads/` |
| 改浏览器扩展的配对/安全 | `main/modules/bridge/` + `extensions/browser/` |
| 加一个右键菜单项（原生菜单） | 对应模块里的 `*Menu.ts`（如 `modules/tags/`） |
| 加一个弹窗 | `renderer/src/features/<功能>/` + `store/slices/dialogs.ts` |
| 改瀑布流/网格排布 | `renderer/src/shared/lib/layout.ts` + `features/gallery/` |
| 改主题颜色 | `renderer/src/shared/styles/theme.scss` |
| 改文案/加翻译 | `shared/i18n/locales/{zh,en}.json` |
| 加一个跨进程接口 | [ipc.md](./ipc.md) |
