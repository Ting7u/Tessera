# 代码约定

约定的目的：让不同的人（和 AI）写出来的代码看起来像同一个人写的。能用工具检查的都写进了 `npm run check`。

## 1. 代码风格

- **语言**：全部 TypeScript（`.ts` / `.tsx`）。不新增 `.js` / `.jsx`（`scripts/*.mjs` 和 `extensions/browser` 除外）。
- **双引号、行尾分号**（C 风格）。格式化用 Prettier，配置在 `.prettierrc.json`，缩进 2 空格，换行符 LF。
- **只用命名导出**（`export function Foo`），不用 `export default`。原因：重命名安全、全局搜索准确、barrel 文件好写。
  唯一例外：配置文件（`electron.vite.config.ts`）。
- **类型导入**用 `import type { X } from "..."`。
- **不用 `any`**。确实不知道类型时用 `unknown` 再收窄。必须断言时（`as`）写一行注释说明为什么安全。
- 不用 `enum`，用字符串联合类型（`type Mode = "copy" | "reference"`）。
- 函数短小，一个函数做一件事；文件超过 ~300 行时考虑拆分。

## 2. 命名

| 对象 | 规则 | 例子 |
| --- | --- | --- |
| React 组件文件 | PascalCase.tsx，与组件同名 | `TagDialog.tsx` |
| 样式 | 与组件同名，放在同一目录 | `TagDialog.module.scss` |
| hook | `useXxx.ts` | `useEscapeKey.ts` |
| 其他文件 | camelCase.ts | `tagColor.ts` |
| 目录 | 小写；多个单词用 `-` | `smart-albums/` |
| 工厂函数 | `createXxx` | `createImporter` |
| 注册 IPC | `registerXxxIpc` | `registerTagsIpc` |
| 测试 | 与被测文件同目录，`xxx.test.ts` | `normalize.test.ts` |
| IPC 通道 | `<域>:<动作>`，小写、`-` 连接 | `library:tag-rename` |
| 数据库列 | snake_case；返回给界面时转 camelCase | `taken_at` → `takenAt` |

## 3. 导入路径

- 跨目录用别名：`@shared/…`、`@main/…`（主进程）、`@renderer/…`（渲染进程）。
- 同一目录或相邻文件用相对路径（`./Foo`）。
- **纯逻辑模块（会被单元测试的）里用相对路径**，因为测试用 `tsx` 直接运行。
- 不要写 `../../../` 超过两层，说明放错位置了。

## 4. 注释

- **写“为什么”，不写“做了什么”**。代码本身说明做了什么。
- 公共函数、模块顶部写一两句说明职责。有坑的地方（安全、性能、平台差异）一定要写明原因，
  现有代码里这类注释很多，修改代码时**保留它们**。
- 中文注释即可（团队语言），技术名词保留英文。

## 5. 多语言（i18n）

- 界面所有用户可见的文字都走翻译：组件里 `const t = useT(); t("key")`，组件外 `import { t }`。
- 词条在 `src/shared/i18n/locales/zh.json` 和 `en.json`，**两个文件必须同时加**，`npm run check:i18n` 会检查
  键是否对齐、占位符是否一致、复数键是否有 `_other`。
- 键名按“位置/功能.含义”写：`settings.maintenance.scan`。
- 复数：传 `{ count }`，词典里写 `key_one` / `key_other`。
- 主进程里的弹窗文字也应该用 `t()`（主进程的 `core/i18n`）。目前还有一批写死的中文，见 [tech-debt.md](./tech-debt.md)，
  **新代码不允许再写死文字**。

## 6. 样式

- 用 CSS Modules（`*.module.scss`），与组件放在同一目录；类名用 camelCase。
- 颜色、间距等一律用 `shared/styles/theme.scss` 里的 CSS 变量，不写死色值（深色/浅色主题才能都对）。
- 多处用到的样式片段放 `shared/styles/_mixins.scss`；多个功能都用的组件放 `shared/ui/`，不要在 feature 之间互相引用 scss。
- 图标：把 `.svg` 放进 `shared/assets/icons/`（文件名就是图标名，用 `stroke="currentColor"`），
  用 `<Icon name="xxx" />`。改图标只需要改那个文件。

## 7. 状态与数据流（渲染进程）

- 跨组件共享的状态进 store；局部状态用 `useState`。
- 组件里订阅 store 时**只选自己需要的字段**（`useAppStore((s) => s.items)`），不要把整个 store 取出来，避免无谓重渲染。
- 调主进程只通过 `api`（`@renderer/shared/api`），不要写 `window.api`。
- 调用主进程会失败，要处理：弹窗里把原因显示在弹窗内；其他情况用 toast。

## 8. 错误处理与日志

- 主进程用 `core/logger` 的 `createLogger("scope")`，不要直接 `console.log`（`console.error` 用于真错误可以）。
- 不要“吞掉”错误后什么都不做；确实可以忽略的（比如清理临时文件失败），写注释说明为什么可以忽略。
- 面向用户的错误信息要写人话，说明发生了什么、用户可以怎么办。

## 9. 测试

- 纯逻辑（不依赖 electron / DOM / 数据库连接）必须有单元测试：`node:test` + `node:assert/strict`，
  文件 `xxx.test.ts`，运行 `npm test`。
- 修 bug 时先写一个能复现 bug 的测试。
- 涉及界面和 Electron 的改动目前靠手动验证，PR 里写明验证了什么（见 [CONTRIBUTING.md](../CONTRIBUTING.md)）。

## 10. 提交

- 提交信息用 Conventional Commits 风格：`feat(tags): 支持批量重命名`、`fix(import): 重复导入时不弹进度`、`docs: ...`、`refactor: ...`。
- 一次提交只做一件事。提交前跑 `npm run check`。
