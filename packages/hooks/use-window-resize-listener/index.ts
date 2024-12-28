import { onMounted, onUnmounted } from 'vue'
import { debounce, generateId } from '@nao-todo/utils'

type Callback = (e: Event) => void

const cbPool = new Map<string, Set<Callback>>()

const debouncedCaller = debounce((e) => {
    cbPool.forEach((cbSet) => {
        cbSet.forEach((cb: Callback) => {
            requestIdleCallback(() => cb(e as Event))
        })
    })
}, 100)

const resizeHandler = (e: unknown) => debouncedCaller(e as Event)

export const useWindowResizeListener = () => {
    const cbSet: Set<Callback> | null = new Set()
    const poolId: string = generateId()

    const addCallback = (callback: Callback) => {
        cbSet.add(callback)
    }

    const removeCallback = (callback: Callback) => {
        cbSet.delete(callback)
    }

    onMounted(() => {
        if (cbSet.size === 0) return
        cbPool.set(poolId, cbSet)
        window.addEventListener('resize', resizeHandler, false)
    })

    onUnmounted(() => {
        if (cbPool.has(poolId)) {
            cbPool.delete(poolId)
        }
        if (cbPool.size !== 0) return
        window.removeEventListener('resize', resizeHandler, false)
    })

    return {
        addCallback,
        removeCallback
    }
}
