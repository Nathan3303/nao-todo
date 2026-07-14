// 预加载脚本，保持最小化并使用安全默认（contextIsolation）。
// 目前渲染进程不需要额外的原生能力桥接，后续如需暴露 API 可在此通过
// contextBridge.exposeInMainWorld 添加。
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
    platform: process.platform
})
