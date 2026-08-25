import { getAvatarSrc } from '@nao-todo/shared/utils/avatar'

/**
 * 头像地址解析（对齐 Web 端 getAvatarSrc，适配 Lynx）
 * @description Web 端 <img src> 相对路径自动基于站点解析；Lynx <image src> 需绝对地址：
 *              外链原样返回；本服务相对路径拼接 API baseURL；空头像返回空串（调用方字母兜底）。
 * @param avatar 后端返回的头像字段
 * @param token 登录 JWT（本地头像需携带凭证）
 * @param baseURL API 基础地址
 * @returns 可直接用于 <image src> 的绝对地址；空返回空串
 */
export const resolveAvatarUrl = (avatar: string, token: string, baseURL: string): string => {
    const src = getAvatarSrc(avatar, token)
    if (src === '') return ''
    // 外链（含 token 拼接后的 http/https）原样返回
    if (/^https?:\/\//i.test(src)) return src
    // 相对路径：拼接 API baseURL
    return `${baseURL}${src.startsWith('/') ? '' : '/'}${src}`
}