// 每分钟执行一次任务
export type UseMinuteTaskOptions = { once: boolean }

// 默认选项
const defaultOptions: UseMinuteTaskOptions = { once: false }

// 每分钟执行一次任务 Hook
export const useMinuteTask = (task: () => void, options?: UseMinuteTaskOptions) => {
    options = options || defaultOptions

    const { once } = options
    let taskTimerId: number | null = null
    let lastRunTime = new Date()

    /**
     * 停止任务执行
     */
    const stop = () => {
        if (!taskTimerId) return
        clearTimeout(taskTimerId)
        taskTimerId = null
    }

    /**
     * 调用任务
     * @param diffTime 任务执行时间间隔
     * @param callback 任务执行完成后回调
     */
    const callTask = (diffTime: number, callback: () => void) => {
        taskTimerId = setTimeout(() => {
            // console.log('[UseMinuteTask] Task run. Diff time is: (' + diffTime + 'ms)')
            requestIdleCallback(() => {
                task()
                callback()
            })
        }, diffTime) as unknown as number
    }

    /**
     * 运行任务
     */
    const run = () => {
        const now = new Date()
        const nextRunTime = new Date(now)
        nextRunTime.setMinutes(nextRunTime.getMinutes() + 1, 0, 0)
        if ((now.getTime() - lastRunTime.getTime()) / (1000 * 60) >= 1) {
            task()
            lastRunTime = now
        }
        const diffTime = nextRunTime.getTime() - now.getTime()
        stop()
        callTask(diffTime, () => {
            lastRunTime = nextRunTime
            if (once) return
            run()
        })
    }

    // 返回任务执行上下文
    return { run, stop }
}