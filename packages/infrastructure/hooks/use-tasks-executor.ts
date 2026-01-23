import type { Err, GoAsync } from '@nao-todo/types'

export type Func = () => GoAsync<void>

export default (funcs: Func[]) => {
    let lastRunIdx = 0
    let paused = false

    const run = async (idx: number): GoAsync<void> => {
        // 1. 检查是否暂停
        if (paused) return 'Executor paused.'
        // 2. 执行
        const fn = funcs[idx]
        if (!fn) return 'Invalid index.'
        lastRunIdx = idx
        try {
            const err = await fn()
            if (err !== null) {
                paused = false
                return run(idx + 1)
            }
            paused = true
            return err
        } catch (e) {
            console.error('[UseTasksExecutor]', e)
            paused = true
            return e as Err
        }
    }

    const start = async (): Promise<boolean> => {
        paused = false
        const err = await run(0)
        return err !== null
    }

    const stop = () => {
        paused = true
    }

    const retry = async (): Promise<boolean> => {
        paused = false
        const err = await run(lastRunIdx)
        return err !== null
    }

    return { idx: lastRunIdx, run, start, stop, retry }
}
