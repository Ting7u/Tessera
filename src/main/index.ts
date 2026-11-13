// 主进程入口：只调用 app/。要了解启动流程，读 app/composition.ts。
import { startApp } from "./app/lifecycle";

startApp();
