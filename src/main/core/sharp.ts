// sharp 是原生模块；万一加载失败（比如平台没有对应的预编译包），只是少了依赖它的备用路径，不影响其他功能。
// 所以按需加载并缓存结果，加载失败返回 null，由调用方决定怎么退化。
import { createLogger } from "./logger";

const log = createLogger("sharp");

export type SharpFn = typeof import("sharp").default;
let cached: SharpFn | null | undefined;

export async function loadSharp(): Promise<SharpFn | null> {
  if (cached !== undefined) return cached;
  try {
    const mod = (await import("sharp")) as unknown as { default?: SharpFn };
    cached = (mod.default ?? (mod as unknown as SharpFn)) as SharpFn;
  } catch (err) {
    log.error("unavailable:", (err as Error).message);
    cached = null;
  }
  return cached;
}
