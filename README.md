# Tessera（拾影）

本地图片库桌面应用：把电脑里散落的图片整理成一个可以搜索、打标签、按条件自动归类的图库。
不上传任何东西，数据都在本机。

- 导入：选文件 / 选文件夹，可“只引用原路径”或“复制到图库托管”，可监听文件夹自动导入
- 浏览：虚拟滚动的瀑布流 / 网格，按拍摄时间、导入时间、名称、大小排序，文件名搜索
- 整理：标签、收藏、智能分类（按时间 / 标签 / 大小 / 收藏组合）、相似图片检测、移动文件（可撤销）
- 下载：拖拽网页图片进窗口，或用[浏览器扩展](./docs/browser-extension.md)右键“下载到 Tessera”
- 中文 / English 界面，深色 / 浅色主题

技术栈：Electron + React 18 + TypeScript（全 TS）+ zustand + SQLite（better-sqlite3）+ sharp。构建用 electron-vite。

## 快速开始

需要 Node.js 20+（推荐 22）。

```bash
npm install
npm run dev          # 开发：启动 Electron，界面热更新
npm run check        # 提交前必跑：类型检查 + i18n + 依赖边界 + IPC 完整性 + 单元测试
npm run dist         # 打 Windows 安装包（dist:mac / dist:linux 同理），输出到 release/
```

只想调界面、不想启动 Electron：`npm run dev` 之后用浏览器打开 `http://localhost:5173`，
会自动使用模拟数据（`src/renderer/src/dev/`）。

## 想改代码？先读这里

| 你是 | 先读 |
| --- | --- |
| 新加入的开发者 | [docs/architecture.md](./docs/architecture.md) → [docs/project-structure.md](./docs/project-structure.md) → [CONTRIBUTING.md](./CONTRIBUTING.md) |
| AI 协作者 | [AGENTS.md](./AGENTS.md)（入口，含规则和地图） |
| 要加功能 | [docs/recipes.md](./docs/recipes.md)（每类改动的操作清单） |
| 想知道有哪些已知问题 | [docs/tech-debt.md](./docs/tech-debt.md) |

完整文档索引见 [docs/README.md](./docs/README.md)。

## 目录一览

```
src/shared/     三个进程共用：类型、常量、IPC 契约、翻译（纯逻辑，不依赖 electron/react）
src/preload/    把 IPC 包装成 window.api（只转发）
src/main/       主进程：数据库、文件、下载、系统菜单；按 app/ core/ db/ modules/ 分层
src/renderer/   界面：app/ features/ shared/ store/ dev/
extensions/browser/   浏览器扩展（独立，不参与构建）
docs/  scripts/       文档、工程检查脚本
```

## 数据存在哪

Electron 的 `userData` 目录（Windows：`%APPDATA%\Tessera`）：`library.db`、`thumbs/`、`library/`、`settings.json`、
`language.json`。**不要修改 package.json 里的 `productName`**，它决定这个目录名，改了老用户会“丢库”
（[决策 0004](./docs/decisions/0004-keep-product-name.md)）。
