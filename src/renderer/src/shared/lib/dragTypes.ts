// 在图库里拖动图片（拖到侧边栏的文件夹上移动）时，dataTransfer 里放图片 id 用的类型名。
// 导入网页图片的拖放逻辑（useDropImport）看到它就不处理，免得把应用内部的拖动当成“下载网页图片”
export const DRAG_IMAGES = "application/x-tessera-images";
