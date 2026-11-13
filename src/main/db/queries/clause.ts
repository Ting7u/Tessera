/** 一段 WHERE 片段 + 绑定参数（全部使用参数绑定，不拼接用户输入） */
export interface Clause {
  sql: string;
  params: unknown[];
}
