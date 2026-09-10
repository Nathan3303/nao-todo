export type UserInitialAvatarProps = {
    /** 昵称（在线 profile 或离线缓存昵称）；空 ⇒ 不提供 default slot，由库内 icon="user" 回落 */
    nickname?: string
    /** 头像 URL（在线）；离线或图片加载失败时由 NueAvatar 自动落 default slot 的首字母 */
    src?: string
    /** 尺寸（透传 NueAvatar） */
    size?: string
    /** 可访问名（i18n 由调用方传入；渲染为 title + aria-label + role="img"） */
    label?: string
}