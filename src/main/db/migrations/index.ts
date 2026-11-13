// 数据库迁移：按顺序执行，版本号存在 PRAGMA user_version 里。
// 以后改表结构只需要在数组末尾追加一项，永远不要修改已发布的项。
import { v1 } from "./v1";
import { v2 } from "./v2";
import { v3 } from "./v3";
import { v4 } from "./v4";

export const migrations: readonly string[] = [v1, v2, v3, v4];
