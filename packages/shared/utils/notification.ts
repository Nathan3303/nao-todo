import { assetUrl } from './asset-url'

/**
 * 浏览器系统通知统一封装
 * @description 统一 Web/桌面/番茄钟的浏览器通知：权限守卫、默认图标、点击聚焦窗口。
 *              title 使用动作语义（如"任务提醒""专注完成"），具体对象（任务名等）放入 body。
 */

export type SendNotificationOptions = {
    /** 通知图标 URL（默认 /favicon.ico） */
    icon?: string
    /** 点击自定义回调（默认仅聚焦窗口并关闭通知） */
    onClick?: () => void
}

/**
 * 发送浏览器系统通知
 * @param title 通知标题（动作语义，如"任务提醒"）
 * @param body 通知正文（如任务名称）
 * @param options 通知选项
 */
export const sendNotification = (
    title: string,
    body?: string,
    options?: SendNotificationOptions
) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const notification = new Notification(title, {
        body: body ?? '',
        // 打包后 file:// 下绝对路径失效，用 assetUrl 生成相对路径
        icon: options?.icon ?? assetUrl('/favicon.ico')
    })
    notification.onclick = () => {
        options?.onClick?.()
        window.focus()
        notification.close()
    }
}