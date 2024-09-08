import type { UseMinuteTaskOptions } from './types'

const defaultOptions: UseMinuteTaskOptions = {
    once: false
}

export const useMinuteTask = (task: Function, options?: UseMinuteTaskOptions) => {
    options = options || defaultOptions

    const { once } = options

    let taskTimerId: number | null = null

    const run = () => {
        let now = new Date()
        let currentMinute = now.getMinutes()
        // 计算直到下一分钟开始还需要等待的时间（毫秒）
        // 注意：如果现在是59分，我们等待0毫秒，因为下一分钟已经开始了
        let waitTime = (60 - currentMinute - 1) * 1000
        if (currentMinute === 59) {
            waitTime = 0 // 如果现在是59分，则无需等待
        }
        // 设置超时，执行任务
        taskTimerId = setTimeout(function () {
            // 这里编写你的任务代码
            // console.log('任务执行: ', new Date().toLocaleTimeString())
            requestIdleCallback(() => task())

            // 再次调用此函数，以便每分钟执行一次
            if (!once) run()
        }, waitTime)
    }

    const stop = () => {
        if (taskTimerId) {
            clearTimeout(taskTimerId)
            taskTimerId = null
        }
    }

    return {
        run,
        stop
    }
}
