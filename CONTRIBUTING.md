# 贡献指南

## 开发环境

- Node.js 20+（推荐 22），npm。
- `npm install` 会安装 Electron 和原生模块（better-sqlite3、sharp）。原生模块装不上时，先确认 Node 版本与 Electron 版本匹配，
  必要时运行 `npx electron-builder install-app-deps`。
- 编辑器：VS Code，装推荐扩展（Prettier、EditorConfig），保存时自动格式化。

## 工作流程

1. 从 `main` 拉分支：`feat/<简述>`、`fix/<简述>`、`refactor/<简述>`、`docs/<简述>`。
2. 先读相关文档（[AGENTS.md](./AGENTS.md) 的“地图”告诉你该看哪）。**加新类型的东西先看 [docs/recipes.md](./docs/recipes.md)**。
3. 小步提交，提交信息用 Conventional Commits：`feat(tags): 支持批量重命名`、`fix(import): …`。
4. 提交前运行 `npm run check`，必须全部通过。
5. 提 PR，描述里写：做了什么、为什么、**怎么验证的**（界面/Electron 改动目前靠手动验证，写清楚点了哪些操作；没法验证的也写明）。
6. 至少一人 review。review 重点：依赖方向、入参校验、数据兼容、文案是否进了 i18n、有没有该写的测试。

## 什么改动需要特别小心

| 改动 | 原因 | 要求 |
| --- | --- | --- |
| 数据库结构 | 用户数据不可丢 | 只能追加迁移；写迁移时用真实旧库验证升级；PR 里写回滚办法 |
| `settings.json` / `language.json` 的键 | 老用户的设置 | 向后兼容：读取时容忍旧格式 |
| IPC 通道名、`tessera://` 地址、桥接 HTTP 接口 | 浏览器扩展和已安装版本 | 只增不改；要改先写决策记录 |
| 文件操作（移动、删除、复制） | 不能损坏用户文件 | 不覆盖、不删原文件；先写单元测试 |
| 主进程入参处理 | 渲染进程不可信 | 必须校验，见 [docs/ipc.md](./docs/ipc.md) |

## 测试

- 纯逻辑（不依赖 electron / DOM / 数据库连接）必须写单元测试：`xxx.test.ts` 放在被测文件旁，`node:test` + `node:assert/strict`。
- 修 bug：先写能复现的测试，再修。
- 运行：`npm test`，或只跑一个文件 `npx tsx --test src/main/modules/downloads/filename.test.ts`。
- 目前没有界面自动化测试和数据库集成测试，是已知缺口（见 [docs/tech-debt.md](./docs/tech-debt.md)），欢迎补。

## 发布

见 [docs/release.md](./docs/release.md)。
