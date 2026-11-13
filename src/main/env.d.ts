// electron-vite 的 `?asset` 导入：构建时把资源文件复制到输出目录，返回运行时路径
declare module "*?asset" {
  const path: string;
  export default path;
}
