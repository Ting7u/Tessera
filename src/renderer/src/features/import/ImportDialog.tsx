import { useEffect, useState } from "react";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { Dialog, Icon, Switch } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import type { ImportMode } from "@shared/types";
import styles from "./ImportDialog.module.scss";

// 导入弹窗
export function ImportDialog() {
  const t = useT();
  const onClose = useAppStore((s) => s.closeImport);
  const startImport = useAppStore((s) => s.startImport);
  // mode / watch / busy 只在弹窗内部使用，属于局部状态，不放进全局 store
  const [mode, setMode] = useState<ImportMode>("reference");
  const [watch, setWatch] = useState(true);
  const [busy, setBusy] = useState(false);

  // 预选上次导入用的入库方式（网页下载的图片也按它入库，所以要让用户看得见）
  useEffect(() => {
    api.importer
      .getImportMode()
      .then((saved) => saved && setMode(saved))
      .catch(() => {
        // 读不到就保持默认的“引用原路径”，不影响使用
      });
  }, []);

  // 弹出系统选择框，选完后在后台导入并关闭弹窗；取消选择则保留弹窗
  const run = async (source: "files" | "folder"): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await startImport({ source, mode, watch });
      if (!result.canceled) onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      locked={busy}
      labelledBy="import-title"
      className={styles.dialog}
      backdropClassName={styles.backdrop}
    >
      <button className={styles.close} aria-label={t("common.close")} onClick={onClose}>
        <Icon name="close" />
      </button>
      <div className={styles.icon}>
        <Icon name="import" size={24} />
      </div>
      <h2 id="import-title" className={styles.title}>
        {t("import.title")}
      </h2>
      <p className={styles.intro}>{t("import.intro")}</p>
      <div className={styles.choices}>
        <button disabled={busy} onClick={() => void run("files")}>
          <Icon name="image" size={20} />
          <span className={styles.copy}>
            <b>{t("import.chooseFiles")}</b>
            <small>{t("import.chooseFilesHint")}</small>
          </span>
        </button>
        <button disabled={busy} onClick={() => void run("folder")}>
          <Icon name="folderOpen" size={20} />
          <span className={styles.copy}>
            <b>{t("import.chooseFolder")}</b>
            <small>{t("import.chooseFolderHint")}</small>
          </span>
        </button>
      </div>
      <div className={styles.modeBlock}>
        <span className={styles.fieldLabel}>{t("import.modeLabel")}</span>
        <div className={styles.modeOptions}>
          {(["reference", "copy"] as const).map((option) => (
            <button
              key={option}
              className={`${styles.modeOption} ${mode === option ? styles.chosen : ""}`}
              onClick={() => setMode(option)}
            >
              <span className={styles.radio} />
              <span className={styles.copy}>
                <b>{t(`import.mode.${option}`)}</b>
                <small>{t(`import.mode.${option}Hint`)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <Switch
        className={styles.watchOption}
        checked={watch}
        onChange={setWatch}
        label={t("import.watch")}
        description={t("import.watchHint")}
      />
      <div className={styles.actions}>
        <button className={styles.textButton} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button className={styles.primary} disabled={busy} onClick={() => void run("folder")}>
          <Icon name="folderOpen" size={17} />
          {t("import.chooseFolder")}
        </button>
      </div>
    </Dialog>
  );
}
