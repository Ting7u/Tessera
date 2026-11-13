// 与主进程的事件同步：首次加载 + 订阅图库变更 / 导入进度 / 提示 / 移动完成 / 各种“被删除”通知。
// 在 app/App.tsx 里调用一次（useEffect 里 return 取消订阅函数）。
import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import { useAppStore } from "./index";

/** “图库变更”时整体刷新的上限，需与主进程 images 仓库 list 的单次上限一致 */
const REFRESH_MAX = 2000;

/** 启动时调用：加载首页并订阅主进程事件，返回取消订阅函数 */
export function startLibrarySync(): () => void {
  const store = () => useAppStore.getState();

  void store().reload();
  void store().refreshSidebar();
  void api.library.setActive(store().active);

  const offs: (() => void)[] = [
    // 导入中图库变化：保持已滚动到的条数刷新；已加载很多时只更新侧边栏，避免大负载
    api.library.onChanged(() => {
      void store().reloadLoaded({ maxLoaded: REFRESH_MAX });
      void store().refreshSidebar();
    }),
    api.importer.onProgress((progress) => store().setProgress(progress)),
    // 主进程发来的提示（如浏览器扩展触发的下载结果）；downloading 为 true 时提示条上显示“取消下载”
    api.app.onNotice(({ text, downloading }) => {
      if (text) store().showToast(text, { downloading: !!downloading });
    }),
    // 移动完成：提示上带“撤销”按钮，多留一会儿（8 秒）
    api.move.onDone(({ token, message }) => {
      store().showToast(message, {
        duration: 8000,
        action: { label: t("common.undo"), run: () => void api.move.undo(token) },
      });
    }),
    // 当前正在看的文件夹被移除了：回到“全部图片”，否则会停在一个已经不存在的空文件夹上
    api.folders.onRemoved((dir) => {
      if (store().active === `folder:${dir}`) store().selectCategory("all");
    }),
    // 标签被删除：缓存里的旧标签去掉；正在看这个标签就回到“全部图片”
    api.tags.onRemoved((name) => {
      store().replaceTag(name, null);
      if (store().active === `tag:${name}`) store().selectCategory("all");
    }),
    // 智能分类被删除（右键菜单）：正在看它就回到“全部图片”
    api.smart.onRemoved((id) => {
      if (store().active === `smart:${id}`) store().selectCategory("all");
    }),
    // 右键菜单选了“重命名”：主进程通知过来，弹出重命名弹窗
    api.tags.onRenameRequest((name) => store().openRenameTag(name)),
    api.smart.onRenameRequest((target) => store().openRenameSmart(target)),
  ];

  return () => offs.forEach((off) => off());
}
