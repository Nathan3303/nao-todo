import moment from 'moment'
import type { UseMinuteTaskOptions } from './types'

const defaultOptions: UseMinuteTaskOptions = {
    once: false
}

export const useMinuteTask = (task: Function, options?: UseMinuteTaskOptions) => {
    options = options || defaultOptions

    const { once } = options

    let taskTimerId: number | null = null
    let lastRunTime = moment()

    const stop = () => {
        if (!taskTimerId) return
        clearTimeout(taskTimerId)
        taskTimerId = null
    }

    const callTask = (diffTime: number, callback: Function) => {
        taskTimerId = setTimeout(() => {
            // console.log('[UseMinuteTask] Task run. Diff time is: (' + diffTime + 'ms)')
            requestIdleCallback(() => {
                task()
                callback()
            })
        }, diffTime)
    }

    const run = () => {
        const now = moment()
        const nextRunTime = moment().add(1, 'minutes').startOf('minute')
        if (now.diff(lastRunTime, 'minutes') >= 1) {
            task()
            lastRunTime = now
        }
        const diffTime = nextRunTime.diff(now)
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
