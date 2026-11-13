import { useEffect } from "react";
import { api } from "@renderer/shared/api";
import { t } from "@renderer/shared/i18n";
import { DRAG_IMAGES } from "@renderer/shared/lib";
import { useAppStore } from "@renderer/store";

// 从拖拽数据里取图片地址。优先取 <img src>：图片外面包着链接时，text/uri-list 给的是链接地址而不是图片地址。
// 用 getAttribute 而不是 img.src，避免相对地址被解析成本应用自己的地址
function extractUrls(dt: DataTransfer): string[] {
  const urls = new Set<string>();
  const html = dt.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html"); // 解析出来的文档是惰性的，不会真的去加载图片
    doc.querySelectorAll("img").forEach((img) => urls.add((img.getAttribute("src") ?? "").trim()));
  }
  if (!urls.size) {
    for (const line of dt.getData("text/uri-list").split(/\r?\n/)) {
      if (line && !line.startsWith("#")) urls.add(line.trim());
    }
  }
  return [...urls].filter((u) => /^https?:\/\//i.test(u));
}

// 把本地文件/文件夹拖进来 → 取真实路径，交给主进程导入（主进程会逐条校验路径）
function importLocalFiles(files: FileList): void {
  const { showToast } = useAppStore.getState();
  // 新版 Electron 的 File 对象没有 .path，要用 preload 暴露的 getPathForFile
  const paths = Array.from(files)
    .map((f) => api.importer.getPathForFile(f))
    .filter(Boolean);
  if (!paths.length) {
    showToast(t("drop.noPath"));
    return;
  }
  api.importer
    .importPaths(paths)
    .then((r) => {
      if (!r.count) showToast(t("drop.noImages")); // 导入进度由 ImportProgress 显示
    })
    .catch((err: unknown) => {
      console.error(err);
      showToast(t("drop.importError"));
    });
}

/** 把图片拖进窗口 → 网页图片下载入库；本地文件/文件夹直接导入（在 App 里调用一次） */
export function useDropImport(): void {
  useEffect(() => {
    const isInternal = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes(DRAG_IMAGES);

    const onDragOver = (event: DragEvent): void => {
      if (isInternal(event)) return; // 应用内部拖动图片（移动到文件夹）：由侧边栏自己处理，这里不当作导入
      event.preventDefault(); // 不阻止的话 drop 事件不会触发，浏览器还会尝试直接打开拖进来的东西
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      if (isInternal(event)) return;
      const dt = event.dataTransfer;
      if (!dt) return;
      const urls = extractUrls(dt);
      if (urls.length)
        void useAppStore.getState().downloadUrls(urls); // 网页图片：优先按网址下载
      else if (dt.files.length) importLocalFiles(dt.files); // 本地文件或文件夹
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
}
