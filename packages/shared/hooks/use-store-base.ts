import { computed, ref } from 'vue'

/**
 * 基础状态管理
 * @template T 状态类型
 * @returns 状态管理对象
 */
export const useStoreBase = <T extends object>() => {
    // @state 状态
    const state = ref<T | null | void>(void 0)

    /**
     * 设置状态
     * @param newState 新状态
     */
    const setState = (newState: T) => {
        state.value = newState
    }

    /**
     * 更新状态
     * @param partialState 部分状态
     */
    const updateState = (partialState: Partial<T>) => {
        if (state.value === null || state.value === void 0) return
        state.value = { ...state.value, ...partialState }
    }

    /**
     * 打补状态
     * @param handler 打补状态处理函数
     */
    const patchState = (handler: (state: T) => Partial<T>) => {
        if (state.value === null || state.value === void 0) return
        const newState = handler({ ...state.value })
        updateState(newState)
    }

    // @returns 状态管理对象
    return {
        state: computed<T>(() => state.value),
        setState,
        updateState,
        patchState
    }
}

