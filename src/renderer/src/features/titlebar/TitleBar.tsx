import { APP_NAME } from "@shared/constants";
import { api } from "@renderer/shared/api";
import styles from "./TitleBar.module.scss";

// Mac 的红黄绿按钮在左上角，标题栏内容要往右让开
const isMac = api.app.platform === "darwin";

// 和应用图标同一套色块（32px 简化版）。深色底是固定的，浅色主题下也保持图标的样子
function Logo() {
  return (
    <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1a1d24" />
      <rect x="4" y="4" width="13" height="14" rx="2" fill="#e0a458" />
      <rect x="19" y="4" width="9" height="8" rx="2" fill="#e9e6df" />
      <rect x="19" y="14" width="9" height="14" rx="2" fill="#6cb4e4" />
      <rect x="4" y="20" width="13" height="8" rx="2" fill="#7cc99a" />
    </svg>
  );
}

export function TitleBar() {
  return (
    <div className={`${styles.titlebar} ${isMac ? styles.mac : ""}`}>
      <Logo />
      <span className={styles.title}>{APP_NAME}</span>
    </div>
  );
}
