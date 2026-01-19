import { States } from './types'

export default (states: States) => {
    let error: boolean = false
    let lastRunIdx = 0
    let paused = false

    const run = async (idx: number): Promise<number> => {
        if (paused) return idx
        const fn = states[idx]
        if (!fn) return idx
        try {
            const ok = await fn()
            if (!ok) {
                error = paused = true
                return idx
            }
            error = paused = false
            return run(idx + 1)
        } catch (e) {
            console.error('[UseStateMachine]', e)
            error = paused = true
            return idx
        }
    }

    const start = async (): Promise<boolean> => {
        error = paused = false
        lastRunIdx = await run(0)
        return lastRunIdx === states.length

    }

    const stop = () => {
        paused = true
    }

    const retry = async (): Promise<boolean> => {
        paused = false
        lastRunIdx = await run(lastRunIdx)
        return lastRunIdx === states.length
    }

    return { error, idx: lastRunIdx, run, start, stop, retry }
}
