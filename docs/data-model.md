# 数据模型与持久化

> 事实来源：`src/main/db/migrations/v1..v4.ts`、`src/main/app/paths.ts`、`src/main/core/settings/index.ts`、`src/main/db/queries/filter.ts`。本文与代码不一致时以代码为准，并请修正本文。

## 磁盘上有什么（Electron `userData` 目录）

| 路径 | 内容 | 备注 |
| --- | --- | --- |
| `library.db` | SQLite 数据库 | 版本号用 `PRAGMA user_version`，迁移见下 |
| `library.json` | 旧版 JSON 存储 | 仅首次启动时自动迁移用 |
| `thumbs/` | 缩略图 | Tessera 自己生成，可以安全删除（会重建/丢失缩略图） |
| `library/` | “复制到图库托管”模式下的图片副本 | 用户数据，不要自动清理 |
| `settings.json` | 设置 | 见下 |
| `language.json` | 界面语言 | |

目录名由 `package.json` 的 `productName`（Tessera）决定。文件名、键名都是历史约定，**不能改**。

## 数据库

迁移规则：**只追加，已发布版本不改**；`database.ts` 在运行迁移前注册自定义 SQL 函数 `dirname`（v3 要用）。
新增一个版本：加 `v5.ts` 并在 `migrations/index.ts` 登记（步骤见 [recipes.md](./recipes.md)）。

| 版本 | 内容 |
| --- | --- |
| v1 | `images`、`tags`、`image_tags`、`watchers`；`images_fts`（FTS5 trigram，文件名子串搜索，查询词需 ≥ 3 个字符）及同步触发器；两个 keyset 分页排序索引 |
| v2 | EXIF 字段（camera、lens、iso、aperture、shutter、focal_length、gps_lat/lon、orientation、has_exif_date、exif_done）；老数据 `exif_done = 0`，后台补读 |
| v3 | `is_favorite`、`phash`、`dir`；`smart_albums` 表；收藏/目录索引 |
| v4 | 按文件名（NOCASE）、大小排序的索引 |

### `images` 关键列语义

- `path`：当前文件位置（托管模式下是图库内副本）；`source_path`：导入时的原始路径（唯一，用于按路径快速跳过）。
- `hash`：内容 SHA-1，唯一，用于去重。
- `managed`：0 = 只引用原文件，1 = 已复制到图库。
- `taken_at`：优先 EXIF 拍摄时间；`has_exif_date = 0` 表示它其实是文件修改时间。
- `phash`：`NULL` = 还没算；`''` = 无法计算（不再重试）。
- `dup_group`：相似图分组，`NULL` = 无相似图。
- `dir`：导入时原始文件所在目录，侧边栏“文件夹”按它分组。
- `thumb`：缩略图文件名（`thumbs/` 下的 basename）。

### 排序与分页

列表用 keyset 分页（`(排序列, id)` 比较），翻到多深都是 O(limit)。所以排序列必须有 `(列, id)` 索引（v1/v4）。新增排序方式时要同时加索引。

## `settings.json` 的键

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `importMode` | `"reference"` \| `"copy"` | 导入方式；读取时不是 `"copy"` 一律当 `"reference"` |
| `downloadDir` | string | 下载目录，缺省时用默认目录 |
| `bridgeTokens` | `{ [扩展Origin]: token }` | 浏览器扩展配对令牌 |
| `partials` | `{ p: 路径, t: 登记时间 }[]` | 下载中的 `.part` 临时文件登记，用于崩溃后清理 |

文件损坏或不存在时按空设置处理。读取处要自己校验类型（文件内容来自磁盘，不可信）。

## 侧边栏 filter 语法（渲染进程和主进程之间的字符串约定）

`all` · `recent`（最近 7 天导入）· `duplicate` · `favorites` · `folder:<目录>` · `tag:<标签名>` · `smart:<id>`

不认识的 filter 在主进程返回“空列表”，不会悄悄显示全部。

## 智能分类规则（`smart_albums.rule`，JSON）

`{ days, tags: string[], minSizeMB, favorite }`，各条件取交集，标签之间是“或”。旧版只有单个 `tag`，读取时兼容（`SmartRule.tag`）。

## 内存状态（重启即失）

- 移动文件的“撤销”只保留最近一次，仅在内存中。
- 导入任务队列、下载进度、维护扫描结果。
