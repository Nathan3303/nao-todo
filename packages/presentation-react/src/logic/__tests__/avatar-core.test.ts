import { describe, expect, it } from 'vite-plus/test'
import { resolveAvatarUrl } from '../avatar-core'

const BASE = 'https://todobe.nathanao.space/api'

describe('avatarCore - 头像地址解析（对齐 Web getAvatarSrc + Lynx 绝对地址）', () => {
    it('空头像返回空串（调用方字母兜底）', () => {
        expect(resolveAvatarUrl('', 'token', BASE)).toBe('')
    })

    it('外链头像原样返回（不带 token）', () => {
        expect(resolveAvatarUrl('https://cdn.example.com/a.png', 'token', BASE)).toBe(
            'https://cdn.example.com/a.png'
        )
    })

    it('本服务相对路径：拼 API baseURL + 携带 token', () => {
        expect(resolveAvatarUrl('/static/uploads/avatars/u1.jpg', 'jwt-abc', BASE)).toBe(
            'https://todobe.nathanao.space/api/static/uploads/avatars/u1.jpg?token=jwt-abc'
        )
    })

    it('相对路径无前导斜杠也能拼接', () => {
        expect(resolveAvatarUrl('static/uploads/avatars/u2.jpg', 't', BASE)).toBe(
            'https://todobe.nathanao.space/api/static/uploads/avatars/u2.jpg?token=t'
        )
    })

    it('已带 query 的本服务路径用 & 拼接 token', () => {
        expect(resolveAvatarUrl('/static/uploads/avatars/u3.jpg?x=1', 't', BASE)).toBe(
            'https://todobe.nathanao.space/api/static/uploads/avatars/u3.jpg?x=1&token=t'
        )
    })

    it('外链形式的本服务头像（带路径）追加 token 而非拼 base', () => {
        // getAvatarSrc 判定 isLocalAvatar 才附加 token；此处验证不含 /static/uploads/avatars/ 的绝对路径原样
        expect(resolveAvatarUrl('https://todobe.nathanao.space/api/other/a.png', 't', BASE)).toBe(
            'https://todobe.nathanao.space/api/other/a.png'
        )
    })
})