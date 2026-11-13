# 常见改动操作清单

每一项都以“照着现有代码模仿”为准；做完都要 `npm run check`。

## 加一个跨进程接口
见 [ipc.md](./ipc.md)：`contract.ts` → `spec.ts` → 主进程 `handle()` → 渲染进程 `api.xxx` → `dev/mockApi.ts`。

## 加一个主进程功能模块
1. 在 `src/main/modules/<名字>/` 建目录，对外只暴露 `index.ts`（其他模块只能 import 它）。
2. 服务用工厂函数 + 依赖参数（`createXxx({ repos, notify, ... })`），不要在模块里直接 import 单例。
3. 如有 IPC，写在模块内的 `ipc.ts`，用 `handle()` 注册，入参先校验（`core/sanitize.ts`）。
4. 在 `src/main/app/composition.ts` 里创建并接线（这里是唯一允许把各模块拼起来的地方）。
5. 纯逻辑拆成单独文件并写 `xxx.test.ts`。
6. 在 [project-structure.md](./project-structure.md) 里登记该模块。

## 加数据库字段/表（迁移）
1. 新建 `src/main/db/migrations/v5.ts`，导出 SQL 字符串（文件头注释写明目的，并保留“已发布的迁移永远不要修改”那行）。
2. 在 `migrations/index.ts` 的数组末尾追加 `v5`。**不要改 v1–v4。**
3. 更新 `shared/types/` 里对应类型、`db/repositories/` 里的读写、必要的索引。
4. 若要新增排序方式：同时为 `(排序列, id)` 加索引（keyset 分页要求）。
5. 用一份旧版本的真实 `library.db` 验证升级后数据完好（目前没有自动化的迁移测试，见 tech-debt）。
6. 更新 [data-model.md](./data-model.md)。

## 加一个弹窗
1. 在 `renderer/src/features/<功能>/` 写组件，外壳用 `shared/ui/Dialog`（遮罩、Esc、点外面关闭已内置）。
2. `store/slices/dialogs.ts` 里加 `showX / openX / closeX`（以及需要的参数）。
3. 在 `app/App.tsx` 用 `<Presence>` 挂上。
4. 在 feature 的 `index.ts` 导出；其他 feature 只能通过 `index.ts` 使用它。

## 加一个“重命名”类弹窗
直接用 `shared/ui/RenameDialog`，传标题、初始值、校验、提交函数（参考标签和智能分类的重命名）。

## 加/改文案
`src/shared/i18n/locales/zh.json` 和 `en.json` **同时**加同名键；组件里 `const t = useT();`。`npm run check:i18n` 会检查两边键是否一致。

## 加图标
把 `xxx.svg` 放进 `renderer/src/shared/assets/icons/`，使用 `<Icon name="xxx" />`。

## 加通用组件
放 `renderer/src/shared/ui/<Name>/`，在 `shared/ui/index.ts` 导出。**shared 不能 import features 或 store。** 同一个东西出现第二次时才抽成通用组件。

## 加全局状态
`renderer/src/store/slices/` 新建 slice，在 `store/index.ts` 合并；组件里用选择器订阅需要的字段，避免订阅整个 store。

## 加侧边栏 filter 类型
`main/db/queries/filter.ts` 的 `filterClause` 加分支 + `queries.test.ts` 加测试；渲染进程生成对应字符串；更新 [data-model.md](./data-model.md) 的语法表。不认识的 filter 必须返回 null。

## 加图片格式
`shared/constants.ts` 的 `IMAGE_EXTS`；确认缩略图/EXIF 对该格式的行为（不能解码时应只入库、不出缩略图，不应报错）。
