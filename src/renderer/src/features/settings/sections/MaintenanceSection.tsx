import { useState } from "react";
import type { CleanMissingKind, ScanMissingResult } from "@shared/types";
import { api } from "@renderer/shared/api";
import { useT } from "@renderer/shared/i18n";
import { useAppStore } from "@renderer/store";
import type { SectionProps } from "./DownloadSection";
import styles from "../SettingsDialog.module.scss";

// 设置 → 维护：扫描并清理已丢失文件的图片记录
export function MaintenanceSection({ busy, setBusy }: SectionProps) {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  // scan 为 null 表示还没检查过；否则是主进程返回的检查结果
  const [scan, setScan] = useState<ScanMissingResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const runScan = async (): Promise<void> => {
    if (scanning) return;
    setScanning(true);
    try {
      setScan(await api.maintenance.scanMissing());
    } catch (err) {
      console.error(err);
      showToast(t("settings.maintenance.scanFailed"));
    } finally {
      setScanning(false);
    }
  };

  // 确认框由主进程弹出；清理完成后检查结果已过期，重新检查一次
  const clean = async (kind: CleanMissingKind): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.maintenance.cleanMissing(kind);
      if (res.ok && !res.canceled) await runScan();
      else if (!res.ok) showToast(res.error || t("settings.maintenance.cleanFailed"));
    } catch (err) {
      console.error(err);
      showToast(t("settings.maintenance.cleanFailedRetry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className={styles.heading}>{t("settings.section.maintenance")}</h3>
      <p className={styles.hint}>{t("settings.maintenance.hint")}</p>

      <button
        className={styles.secondary}
        disabled={scanning || busy}
        onClick={() => void runScan()}
      >
        {scanning
          ? t("settings.maintenance.scanning")
          : scan
            ? t("settings.maintenance.rescan")
            : t("settings.maintenance.scan")}
      </button>

      {scan && !scanning && (
        <div className={styles.result}>
          <p className={styles.summary}>
            {t("settings.maintenance.checked", { count: scan.total })}
          </p>
          {scan.lost === 0 && scan.unreachable === 0 && (
            <p className={styles.ok}>{t("settings.maintenance.noneMissing")}</p>
          )}

          {scan.lost > 0 && (
            <div className={styles.group}>
              <div>
                <b>{t("settings.maintenance.lost", { count: scan.lost })}</b>
                <small>{t("settings.maintenance.lostHint")}</small>
              </div>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() => void clean("lost")}
              >
                {t("settings.maintenance.removeRecords")}
              </button>
            </div>
          )}

          {scan.unreachable > 0 && (
            <div className={styles.group}>
              <div>
                <b>{t("settings.maintenance.unreachable", { count: scan.unreachable })}</b>
                <small>{t("settings.maintenance.unreachableHint")}</small>
                <ul className={styles.dirs}>
                  {scan.dirs.map((dir) => (
                    <li key={dir} title={dir}>
                      {dir}
                    </li>
                  ))}
                  {scan.dirCount > scan.dirs.length && (
                    <li>{t("settings.maintenance.moreFolders", { count: scan.dirCount })}</li>
                  )}
                </ul>
              </div>
              <button
                className={styles.secondary}
                disabled={busy}
                onClick={() => void clean("unreachable")}
              >
                {t("settings.maintenance.removeRecords")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
