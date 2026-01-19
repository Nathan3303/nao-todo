import { ref } from 'vue'

export const clone = <T>(value: T) => JSON.parse(JSON.stringify(value))

export const useResettableRef = <T>(initialValue: T) => {
    const backup = clone(initialValue)
    const refObject = ref<T>(initialValue)
    const reset = () => (refObject.value = clone(backup))
    return [refObject, reset] as const
}
