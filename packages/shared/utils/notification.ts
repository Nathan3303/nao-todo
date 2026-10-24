import { assetUrl } from './asset-url'

/**
 * 浏览器系统通知统一封装
 * @description 统一 Web/桌面/番茄钟的浏览器通知：权限守卫、默认图标、点击聚焦窗口。
 *              title 使用动作语义（如"任务提醒""专注完成"），具体对象（任务名等）放入 body。
 *
 *              **全函数（T531 / AC10）**：本层是「通知失败 ≠ 提醒丢失」的唯一兜底 ——
 *              `new Notification` 在 Android Chrome 页面通知被禁用时会抛 `TypeError`，
 *              若异常冒到提醒引擎（`claim` 已落、`consume` 未执行）⇒ 该条永久不再提醒。
 *              因此本函数**永不抛**，一律以布尔值返回「是否已交付」。
 */

export type SendNotificationOptions = {
    /** 通知图标 URL（默认 /favicon.ico） */
    icon?: string
    /** 点击自定义回调（默认仅聚焦窗口并关闭通知） */
    onClick?: () => void
    /** 静音（声音开关映射 `silent: !sound`；用系统通知自带声音，不新增音频素材） */
    silent?: boolean
}

/**
 * 发送浏览器系统通知
 * @param title 通知标题（动作语义，如"任务提醒"）
 * @param body 通知正文（如任务名称）
 * @param options 通知选项
 * @returns `true` = 已交给系统通知；`false` = 未发出（无 API / 未授权 / 构造抛错）
 */
export const sendNotification = (
    title: string,
    body?: string,
    options?: SendNotificationOptions
): boolean => {
    try {
        if (typeof window === 'undefined' || !('Notification' in window)) return false
        if (Notification.permission !== 'granted') return false
        const notification = new Notification(title, {
            body: body ?? '',
            // 打包后 file:// 下绝对路径失效，用 assetUrl 生成相对路径
            icon: options?.icon ?? assetUrl('/favicon.ico'),
            silent: options?.silent
        })
        notification.onclick = () => {
            options?.onClick?.()
            window.focus()
            notification.close()
        }
        return true
    } catch {
        // Android Chrome 页面通知被禁用 / 非安全上下文：降级为「未送达」，不得抛给调用方
        return false
    }
}