import { useEffect } from "react";
import { Presence } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import { startLibrarySync } from "@renderer/store/librarySync";
import { DetailPanel } from "@renderer/features/detail";
import { DuplicateNotice, Gallery, GalleryTitle } from "@renderer/features/gallery";
import { ImportDialog, ImportProgress, useDropImport } from "@renderer/features/import";
import { MoveDialog } from "@renderer/features/move";
import { SelectionBar } from "@renderer/features/selection";
import { SettingsDialog } from "@renderer/features/settings";
import { Sidebar } from "@renderer/features/sidebar";
import { RenameSmartDialog, SmartDialog } from "@renderer/features/smart-albums";
import { RenameTagDialog, TagDialog } from "@renderer/features/tags";
import { TitleBar } from "@renderer/features/titlebar";
import { TopBar } from "@renderer/features/topbar";
import { ToastHost } from "./ToastHost";
import { useThemeEffect } from "./useThemeEffect";
import styles from "./App.module.scss";

/** 根组件：只负责把各功能摆在一起，并挂上全局副作用（主题、与主进程同步、拖拽导入） */
export function App() {
  // 全局副作用
  useThemeEffect(); // 根据设置切换主题（亮/暗）
  useEffect(() => startLibrarySync(), []); // 启动和主进程的数据同步（只执行一次）
  useDropImport(); // 支持把文件拖进窗口导入

  // 读取"哪些弹窗该显示"的状态
  const showImport = useAppStore((s) => s.showImport);
  const showSettings = useAppStore((s) => s.showSettings);
  const showMove = useAppStore((s) => s.showMove);
  const showSmart = useAppStore((s) => s.showSmart);
  const showTag = useAppStore((s) => s.showTag);
  const showRenameTag = useAppStore((s) => s.showRenameTag);
  const renameTagFrom = useAppStore((s) => s.renameTagFrom);
  const showRenameSmart = useAppStore((s) => s.showRenameSmart);
  const renameSmartId = useAppStore((s) => s.renameSmartTarget?.id);

  return (
    <>
      <div className={styles.app}>
        <TitleBar />
        <Sidebar />
        <main className={styles.main}>
          <TopBar />
          <DuplicateNotice />
          <SelectionBar />
          <GalleryTitle />
          <Gallery />
        </main>
        {/* Presence：关闭时先播完退出动画再卸载 */}
        <Presence show={showImport}>
          <ImportDialog />
        </Presence>
        <Presence show={showSettings}>
          <SettingsDialog />
        </Presence>
        <Presence show={showMove}>
          <MoveDialog />
        </Presence>
        <Presence show={showSmart}>
          <SmartDialog />
        </Presence>
        <Presence show={showTag}>
          <TagDialog />
        </Presence>
        {/* key：关闭动画期间又对另一项点“重命名”时，输入框内容要跟着换 */}
        <Presence show={showRenameTag}>
          <RenameTagDialog key={renameTagFrom ?? undefined} />
        </Presence>
        <Presence show={showRenameSmart}>
          <RenameSmartDialog key={renameSmartId} />
        </Presence>
        <ImportProgress />
        <ToastHost />
      </div>
      {/* DetailPanel 与 .app 同级：它是全屏模态层，不参与 App 内部的 grid 布局 */}
      <DetailPanel />
    </>
  );
}
