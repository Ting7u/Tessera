// 移动文件、维护（清理丢失图片）相关的数据结构

export interface MovePreview {
  movable: number;
  managed: number;
  missing: number;
}

export type MoveChooseResult = { canceled: true } | { canceled: false; dir: string };

export interface MoveRequest {
  ids: number[];
  dir: string;
}

export type MoveResult =
  | { ok: false; error: string }
  | {
      ok: true;
      moved: number;
      same: number;
      managed: number;
      missing: number;
      failed: number;
      error: string;
      message: string;
    };

export type UndoMoveResult =
  | { ok: false; error: string }
  | { ok: true; restored: number; skipped: number; failed: number; message: string };

export interface MoveDonePayload {
  token: string;
  message: string;
}

export interface ScanMissingResult {
  total: number;
  /** 文件不存在，但所在文件夹还在 */
  lost: number;
  /** 连所在文件夹都找不到（可能是硬盘没连接） */
  unreachable: number;
  /** 找不到的文件夹示例（最多几个） */
  dirs: string[];
  dirCount: number;
}

export type CleanMissingKind = "lost" | "unreachable";

export type CleanMissingResult =
  | { ok: false; error: string }
  | { ok: true; removed: number; canceled?: boolean };
