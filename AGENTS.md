# AGENTS.md — 给 AI 协作者的入口

Tessera（拾影）：Electron + React + TypeScript 本地图片库。人类开发者同样适用本文件。
读完本文件 + [docs/project-structure.md](./docs/project-structure.md) 就可以开始干活。

## 先做这三件事

1. 读 [docs/architecture.md](./docs/architecture.md)（10 分钟：三个进程、依赖方向、IPC）。
2. 找到你要改的功能目录（见下方“地图”），**先读该目录的 `index.ts` 和相邻文件**，模仿现有写法。
3. 改完跑 `npm run check`，全绿才算完成。

## 硬规则（违反会被 `npm run check` 拦下或造成事故）

1. **依赖方向**：`shared` 不依赖任何人；`main` / `renderer` 互不依赖，只通过 IPC 对话；
   主进程 `modules/*` 之间只能经对方的 `index.ts`；渲染进程 `features/*` 之间同理。（`check:boundaries`）
2. **IPC 只走契约**：新增接口先改 `src/shared/ipc/contract.ts` + `spec.ts`，再在主进程 `handle()`。
   渲染进程只用 `import { api } from "@renderer/shared/api"`，不写 `window.api`，不 import electron。
3. **渲染进程传来的参数都不可信**：处理函数必须用 `core/sanitize.ts` 校验；界面只传 id，不传路径。
4. **永不删除用户原文件**；只删 Tessera 自己生成的缩略图。移动文件不得覆盖已有文件。
5. **数据库迁移只追加**：`src/main/db/migrations/` 里已发布的版本一个字符都不要改，加 `v5.ts`。
6. **不要改 `package.json` 的 `name` / `productName`**（决定用户数据目录），也不要改 `userData` 下的文件名、
   `settings.json` 的键、`tessera://` 地址格式、IPC 通道名里已有的部分（会破坏老用户数据或浏览器扩展）。
7. **用户可见文字走 i18n**：组件里 `useT()`，`zh.json` 和 `en.json` 同时加键。主进程里新代码也不许写死文字。
8. **代码风格**：全 TypeScript、双引号、行尾分号、只用命名导出、不用 `any`。格式化：`npx prettier --write <文件>`。
9. **保留“为什么”类注释**（安全、性能、平台差异）；注释写原因不写做了什么。
10. 纯逻辑要有 `node:test` 单元测试，放在被测文件旁边（`xxx.test.ts`），用相对路径导入。

## 地图：我要改 X

| 需求 | 位置 |
| --- | --- |
| 导入 / 去重 / 复制托管 | `src/main/modules/importer/` |
| 缩略图 | `src/main/modules/thumbnails/` |
| 列表 SQL（筛选、排序、搜索、分页） | `src/main/db/queries/`、`db/repositories/images.ts` |
| 加数据库字段 | 新迁移 `db/migrations/v5.ts` + `shared/types/image.ts` + `repositories/images.ts` |
| 下载 | `src/main/modules/downloads/`；浏览器扩展接口 `modules/bridge/` |
| 原生右键菜单 | 对应模块里的 menu 文件（`modules/tags`、`smart-albums`、`folders`、`images`） |
| 加弹窗 | `renderer/src/features/<功能>/` + `store/slices/dialogs.ts`；骨架用 `shared/ui/Dialog` |
| 瀑布流 / 网格排布 | `renderer/src/shared/lib/layout.ts`、`features/gallery/` |
| 全局状态 | `renderer/src/store/slices/` |
| 主题色 | `renderer/src/shared/styles/theme.scss` |
| 文案 | `src/shared/i18n/locales/{zh,en}.json` |
| 加跨进程接口 | [docs/ipc.md](./docs/ipc.md) |

其他“怎么加 X”的操作清单：[docs/recipes.md](./docs/recipes.md)。

## 常用命令

```bash
npm run dev            # 开发（Electron）；浏览器打开 localhost:5173 可用模拟数据调界面
npm run check          # = typecheck + check:i18n + check:boundaries + check:ipc + test
npm test               # 单元测试（node:test + tsx）
npm run typecheck      # 分别检查 Node 侧（tsconfig.json）和渲染进程（src/renderer/tsconfig.json）
```

## 做事方式

- 小步修改，一次只做一件事；改动范围外的代码不要顺手“优化”。
- 不确定行为时，看对应的单元测试和 [docs/data-model.md](./docs/data-model.md)；仍不确定就问人，不要猜。
- 发现不合理但不在本次范围的东西，记到 [docs/tech-debt.md](./docs/tech-debt.md)，不要悄悄改行为。
- 做了重要的架构取舍，在 `docs/decisions/` 加一篇简短的决策记录。
- 界面和 Electron 相关的改动目前没有自动化测试：在回复/PR 里写清楚你**手动验证了什么**、**没法验证什么**。
