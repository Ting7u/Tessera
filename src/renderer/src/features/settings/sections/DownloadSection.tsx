import { useEffect, useState } from "react";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "../SettingsDialog.module.scss";

export interface SectionProps {
  /** 有操作在进行：设置窗口据此禁止关闭 */
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

// 设置 → 下载：网页图片的保存文件夹
export function DownloadSection({ busy, setBusy }: SectionProps) {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  // undefined：还在读取；null：还没选过下载文件夹；字符串：当前下载文件夹
  const [downloadDir, setDownloadDir] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api.downloads
      .getDir()
      .then((dir) => setDownloadDir(dir ?? null))
      .catch(() => setDownloadDir(null));
  }, []);

  const changeDownloadDir = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const dir = await api.downloads.chooseDir(); // 用户取消返回 null
      if (dir) {
        setDownloadDir(dir);
        showToast(t("settings.download.changed", { dir }), { duration: 2500, type: "success" });
      }
    } catch (err) {
      console.error(err);
      showToast(t("settings.download.changeFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className={styles.heading}>{t("settings.section.download")}</h3>
      <p className={styles.hint}>{t("settings.download.hint", { all: t("category.all") })}</p>

      <span className={styles.fieldLabel}>{t("settings.download.dirLabel")}</span>
      <div className={styles.pathRow}>
        <div
          className={`${styles.path} ${downloadDir ? "" : styles.empty}`}
          title={downloadDir || ""}
        >
          <Icon name="folderOpen" size={16} />
          <span>
            {downloadDir === undefined
              ? t("settings.download.loading")
              : downloadDir || t("settings.download.notChosen")}
          </span>
        </div>
        <button
          className={styles.secondary}
          disabled={busy || downloadDir === undefined}
          onClick={() => void changeDownloadDir()}
        >
          {downloadDir ? t("settings.download.change") : t("settings.download.choose")}
        </button>
      </div>
    </>
  );
}
