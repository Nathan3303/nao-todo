import { LocalTaskRepoImpl } from '@nao-todo/infrastructure'

/**
 * 本地任务提醒扫描器
 * @description 桌面版替代远程 SSE 提醒：定时扫描本地任务，
 *              到期的 remindAt 触发系统通知（每个任务本会话只提醒一次）。
 *              提醒对话框由应用内任务详情承载，此处仅负责系统通知。
 */
const SCAN_INTERVAL_MS = 30_000

export const useLocalReminder = () => {
    const taskRepo = new LocalTaskRepoImpl()
    const notifiedIds = new Set<string>()
    let timer: ReturnType<typeof setInterval> | null = null

    /**
     * 扫描一轮到期提醒
     */
    const scan = async () => {
        const [result, err] = await taskRepo.list('isDeleted=false')
        if (err !== null) return
        const now = Date.now()
        for (const task of result.taskEntities) {
            if (!task.remindAt) continue
            if (notifiedIds.has(task.id)) continue
            if (new Date(task.remindAt).getTime() > now) continue
            notifiedIds.add(task.id)
            if (!('Notification' in window) || Notification.permission !== 'granted') continue
            const notification = new Notification(task.name, {
                body: task.description || '',
                silent: false
            })
            notification.onclick = () => {
                window.focus()
                notification.close()
            }
        }
    }

    /**
     * 启动扫描
     */
    const start = () => {
        if (timer !== null) return
        // 请求通知权限（Electron 中默认授予）
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
        void scan()
        timer = setInterval(() => void scan(), SCAN_INTERVAL_MS)
    }

    /**
     * 停止扫描
     */
    const stop = () => {
        if (timer !== null) {
            clearInterval(timer)
            timer = null
        }
    }

    return { start, stop }
}