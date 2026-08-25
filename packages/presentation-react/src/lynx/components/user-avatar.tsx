import { useMemo } from '@lynx-js/react'
import { resolveAvatarUrl } from '../../logic/avatar-core'
import { getApiBaseURL } from '../../logic/app-config-core'
import './user-avatar.css'

export type UserAvatarProps = {
    /** 后端返回的头像字段（可能为空） */
    avatar: string
    /** 昵称（无头像时字母兜底） */
    nickname: string
    /** 登录 JWT（本地头像需携带凭证） */
    token: string
    /** 尺寸（rpx，默认 88） */
    size?: number
}

/**
 * 用户头像（真实头像加载 + 字母兜底）
 * @description 有头像时加载远程图片（aspectFill 圆形）；无头像显示昵称首字母
 *              （沿用黄铜双环印章视觉）；地址经 resolveAvatarUrl 解析（相对路径拼 API base）。
 */
export const UserAvatar = ({ avatar, nickname, token, size = 88 }: UserAvatarProps) => {
    const src = useMemo(() => resolveAvatarUrl(avatar, token, getApiBaseURL()), [avatar, token])

    if (src !== '') {
        return (
            <image
                className="uavatar-img"
                src={src}
                mode="aspectFill"
                style={{
                    width: `${size}rpx`,
                    height: `${size}rpx`,
                    borderRadius: `${size / 2}rpx`
                }}
            />
        )
    }

    return (
        <view
            className="uavatar-fallback"
            style={{ width: `${size}rpx`, height: `${size}rpx`, borderRadius: `${size / 2}rpx` }}
        >
            <text
                className="uavatar-fallback-text"
                style={{ fontSize: `${Math.floor(size / 2.4)}rpx` }}
            >
                {nickname.slice(0, 1).toUpperCase()}
            </text>
        </view>
    )
}