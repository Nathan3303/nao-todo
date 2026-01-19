import type { UseMinuteTaskOptions } from './types'

const defaultOptions: UseMinuteTaskOptions = {
    once: false
}

const useMinuteTask = (task: () => void, options?: UseMinuteTaskOptions) => {
    options = options || defaultOptions

    const { once } = options

    let taskTimerId: number | null = null
    let lastRunTime = new Date()

    const stop = () => {
        if (!taskTimerId) return
        clearTimeout(taskTimerId)
        taskTimerId = null
    }

    const callTask = (diffTime: number, callback: () => void) => {
        taskTimerId = setTimeout(() => {
            // console.log('[UseMinuteTask] Task run. Diff time is: (' + diffTime + 'ms)')
            requestIdleCallback(() => {
                task()
                callback()
            })
        }, diffTime) as unknown as number
    }

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

    return {
        run,
        stop
    }
}

export default useMinuteTask
