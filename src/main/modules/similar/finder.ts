// 相似图片后台任务：补算缺失的 dHash，然后重新分组。
import path from "node:path";
import type { ImagesRepository } from "../../db/repositories";
import { dhash } from "./dhash";
import { groupSimilar } from "./grouping";

const BATCH = 100;

export interface SimilarFinderDeps {
  images: Pick<ImagesRepository, "pendingHash" | "setHashes" | "allHashes" | "regroupSimilar">;
  thumbsDir: string;
}

export function createSimilarFinder({ images, thumbsDir }: SimilarFinderDeps): {
  run(): Promise<boolean>;
} {
  let running = false;

  /** 补算还没有哈希的图片，然后重新分组。返回分组是否有变化 */
  async function run(): Promise<boolean> {
    if (running) return false;
    running = true;
    try {
      for (;;) {
        const batch = images.pendingHash(BATCH);
        if (!batch.length) break;
        images.setHashes(
          batch.map(({ id, thumb }) => ({
            id,
            phash: thumb ? dhash(path.join(thumbsDir, thumb)) : "",
          })),
        );
        await new Promise<void>((resolve) => setImmediate(resolve)); // 让出事件循环，避免卡住界面
      }
      return images.regroupSimilar(groupSimilar(images.allHashes()));
    } finally {
      running = false;
    }
  }

  return { run };
}
