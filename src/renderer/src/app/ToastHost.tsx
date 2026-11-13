import { api } from "@renderer/shared/api";
import { Toast } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";

/** 把 store 里的提示状态连到 Toast 组件（Toast 本身是纯展示，放在 shared/ui） */
export function ToastHost() {
  const toast = useAppStore((s) => s.toast);
  const type = useAppStore((s) => s.toastType);
  const id = useAppStore((s) => s.toastId);
  const action = useAppStore((s) => s.toastAction);
  const downloading = useAppStore((s) => s.toastDownloading);
  const dismissToast = useAppStore((s) => s.dismissToast);
  if (!toast) return null;

  return (
    // key：每次新提示都重新挂载，滑入动画会重新播放。
    // 下载进度每 0.5 秒刷新一次，用固定 key，否则“取消下载”按钮不停重建，点击会落空
    <Toast
      key={downloading ? "downloading" : id}
      text={toast}
      type={type}
      action={action}
      onAction={(a) => {
        dismissToast(); // 点完提示就收起，结果会有新的提示
        a.run();
      }}
      onCancelDownload={downloading ? () => void api.downloads.cancel() : undefined}
    />
  );
}
