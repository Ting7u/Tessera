// electron-vite 配置：同时构建 主进程(main) / 预加载脚本(preload) / 渲染进程(renderer)。
// 别名（@shared 等）必须和 tsconfig 里的 paths 保持一致，改一处时两处一起改。
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const shared = resolve("src/shared");

export default defineConfig({
  main: {
    // dependencies（better-sqlite3、sharp 等原生模块）不打进包里，运行时从 node_modules 加载
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { "@shared": shared, "@main": resolve("src/main") },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { "@shared": shared },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { "@shared": shared, "@renderer": resolve("src/renderer/src") },
    },
    server: { port: 5173, strictPort: true },
    css: {
      preprocessorOptions: {
        scss: { api: "modern-compiler" },
      },
    },
  },
});
