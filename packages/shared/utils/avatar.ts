/**
 * 是否为本地头像资源路径
 * @param url 头像地址
 * @returns 是否为本地头像
 */
const isLocalAvatar = (url: string): boolean => url.includes('/static/uploads/avatars/')

/**
 * 是否为外部绝对 URL
 * @param url 头像地址
 * @returns 是否为外部绝对 URL
 */
const isExternalUrl = (url: string): boolean => /^https?:\/\//i.test(url)

/**
 * 生成可加载的头像地址
 * @description 本地头像需要携带登录凭证（JWT），外链头像原样返回
 * @param avatar 后端返回的头像字段（可能为空 / 外链 / 本服务相对或完整路径）
 * @param token 当前登录 JWT（登录后才有）
 * @returns 可直接用于 `<img src>` 的地址；空返回空串由调用方兜底默认头像
 */
export const getAvatarSrc = (avatar: string, token: string): string => {
    if (!avatar) return ''
    // 外链头像：无需 token
    if (isExternalUrl(avatar) && !isLocalAvatar(avatar)) return avatar
    // 本服务头像：追加 token（注意处理可能已带 query 的情况）
    const sep = avatar.includes('?') ? '&' : '?'
    return `${avatar}${sep}token=${encodeURIComponent(token)}`
}