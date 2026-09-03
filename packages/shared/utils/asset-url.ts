/**
 * 静态资源 URL 解析
 * @description 兼容 Web（BASE_URL='/' → /images/x）与桌面打包（electron-vite 默认
 *              base='./' → ./images/x，file:// 协议下相对 index.html 目录可加载）。
 *              修复打包后 <img>/nue-empty 图片绝对路径失效问题。
 */
export const assetUrl = (path: string): string => {
    const baseUrl = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
    return baseUrl + path.replace(/^\//, '')
}