import { ref } from 'vue'

type ExecuteId = string
type ExecutePayload = Record<string, any>
type ExecuteFunc = (payload?: ExecutePayload) => unknown
type ExecuteFuncs = Map<ExecuteId, ExecuteFunc>

const useDropdownExecutor = () => {
    const executeFuncs = ref<ExecuteFuncs>(new Map())

    const register = (executeId: string, func: ExecuteFunc) => {
        executeFuncs.value.set(executeId, func)
    }

    const unregister = (executeId: string) => {
        executeFuncs.value.delete(executeId)
    }

    const unregisterAll = () => {
        executeFuncs.value.clear()
    }

    const execute = (executeId: string, payload?: ExecutePayload) => {
        const func = executeFuncs.value.get(executeId)
        if (func instanceof Function) {
            func(payload)
        } else {
            console.error(`executeId: ${executeId} not found`)
        }
    }

    return {
        register,
        unregister,
        unregisterAll,
        execute
    }
}

export default useDropdownExecutor
