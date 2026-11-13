import { useState } from "react";
import { useT } from "@renderer/shared/i18n";
import { Dialog, Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import { DownloadSection } from "./sections/DownloadSection";
import { LanguageSection } from "./sections/LanguageSection";
import { MaintenanceSection } from "./sections/MaintenanceSection";
import styles from "./SettingsDialog.module.scss";

// 设置窗口：和导入弹窗一样是挂在 App 里的模态窗口（左边分类，右边内容）。
// 加一个设置分类：在 SECTIONS 里加一项（名字写进 locales），再在 sections/ 里写对应组件并在下面渲染。
const SECTIONS = [
  { id: "download", labelKey: "settings.section.download" },
  { id: "maintenance", labelKey: "settings.section.maintenance" },
  { id: "language", labelKey: "settings.section.language" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsDialog() {
  const t = useT();
  const onClose = useAppStore((s) => s.closeSettings);
  const [section, setSection] = useState<SectionId>("download");
  // 某个分类里有操作在进行（选文件夹、清理）时不允许关闭窗口；选择文件夹的系统对话框打开时按 Esc 属于对话框，不会走到这里
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      onClose={onClose}
      locked={busy}
      labelledBy="settings-title"
      className={styles.dialog}
      backdropClassName={styles.backdrop}
    >
      <nav className={styles.nav} aria-label={t("settings.nav.aria")}>
        <h2 id="settings-title" className={styles.title}>
          {t("settings.title")}
        </h2>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${section === item.id ? styles.current : ""}`}
            onClick={() => setSection(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        <button className={styles.close} aria-label={t("common.close")} onClick={onClose}>
          <Icon name="close" />
        </button>

        {section === "download" && <DownloadSection busy={busy} setBusy={setBusy} />}
        {section === "maintenance" && <MaintenanceSection busy={busy} setBusy={setBusy} />}
        {section === "language" && <LanguageSection />}
      </div>
    </Dialog>
  );
}
