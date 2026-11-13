import { useEffect, useState } from "react";
import type { MovePreview } from "@shared/types";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { Dialog, Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./MoveDialog.module.scss";

interface Target {
  dir: string;
  label: string;
}

// “移动到文件夹”弹窗：把选中图片的原文件真正移到另一个文件夹。
// 目标可以是图库里已有的文件夹，或者用系统选择框选一个新的；点“移动”才执行
export function MoveDialog() {
  const t = useT();
  const ids = useAppStore((s) => s.moveIds);
  const onClose = useAppStore((s) => s.closeMove);
  const folders = useAppStore((s) => s.sidebar.folders);
  const active = useAppStore((s) => s.active);
  const clearSelected = useAppStore((s) => s.clearSelected);

  const [preview, setPreview] = useState<MovePreview | null>(null); // null 表示还在统计
  const [target, setTarget] = useState<Target | null>(null);
  const [picked, setPicked] = useState<Target | null>(null); // 通过选择框选出的文件夹（不在图库列表里时额外显示一行）
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.move
      .preview(ids)
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setPreview({ movable: ids.length, managed: 0, missing: 0 }));
    return () => {
      alive = false;
    };
  }, [ids]);

  const choose = async (): Promise<void> => {
    if (busy) return;
    const res = await api.move.choose();
    if (res.canceled) return;
    const label = res.dir.split(/[\\/]/).filter(Boolean).pop() || res.dir;
    if (!folders.some((f) => f.path === res.dir)) setPicked({ dir: res.dir, label });
    setTarget({ dir: res.dir, label });
  };

  const run = async (): Promise<void> => {
    if (!target || busy) return;
    setBusy(true);
    try {
      const res = await api.move.move({ ids, dir: target.dir });
      if (res.ok) {
        clearSelected(); // 提示文字由主进程通过 move-done 事件发出，界面会弹出带“撤销”的提示
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    ...folders.map((f) => ({
      dir: f.path,
      label: f.label,
      count: f.count as number | null,
      current: active === f.key,
    })),
    ...(picked ? [{ dir: picked.dir, label: picked.label, count: null, current: false }] : []),
  ];
  const movable = preview?.movable ?? 0;

  return (
    <Dialog
      onClose={onClose}
      locked={busy}
      labelledBy="move-title"
      className={styles.dialog}
      backdropClassName={styles.backdrop}
    >
      <button className={styles.close} aria-label={t("common.close")} onClick={onClose}>
        <Icon name="close" />
      </button>
      <h2 id="move-title" className={styles.title}>
        {t("move.title")}
      </h2>
      <p className={styles.intro}>
        {preview === null ? t("move.counting") : t("move.intro", { count: movable })}
      </p>

      {preview && (preview.managed > 0 || preview.missing > 0) && (
        <ul className={styles.notes}>
          {preview.managed > 0 && (
            <li>
              {t("move.note.managed", { count: preview.managed, mode: t("import.mode.copy") })}
            </li>
          )}
          {preview.missing > 0 && <li>{t("move.note.missing", { count: preview.missing })}</li>}
        </ul>
      )}

      <div className={styles.list} role="listbox" aria-label={t("move.targetAria")}>
        {rows.map((row) => (
          <button
            key={row.dir}
            role="option"
            aria-selected={target?.dir === row.dir}
            disabled={row.current || busy}
            className={`${styles.row} ${target?.dir === row.dir ? styles.chosen : ""}`}
            title={row.dir}
            onClick={() => setTarget({ dir: row.dir, label: row.label })}
          >
            <Icon name="folder" size={16} />
            <span className={styles.copy}>
              <b>{row.label}</b>
              <small>{row.current ? t("move.currentFolder") : row.dir}</small>
            </span>
            {row.count != null && <span className={styles.count}>{row.count}</span>}
          </button>
        ))}
        <button className={styles.other} disabled={busy} onClick={() => void choose()}>
          <Icon name="folderOpen" size={16} />
          {t("move.chooseOther")}
        </button>
      </div>

      <div className={styles.actions}>
        <button className={styles.textButton} disabled={busy} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button
          className={styles.primary}
          disabled={!target || busy || movable === 0}
          onClick={() => void run()}
        >
          {busy ? t("move.moving") : t("move.confirm", { count: movable })}
        </button>
      </div>
    </Dialog>
  );
}
