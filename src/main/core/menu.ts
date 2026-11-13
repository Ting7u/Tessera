// 原生右键菜单项的点击处理：出错时记日志并在界面提示，而不是变成未处理的 Promise 拒绝。
import { createLogger } from "./logger";
import { say } from "./notify";

export function runSafely(scope: string, fn: () => unknown): () => void {
  const log = createLogger(scope);
  return () => {
    Promise.resolve()
      .then(fn)
      .catch((err: Error) => {
        log.error(err);
        say(`操作失败：${err.message}`);
      });
  };
}
