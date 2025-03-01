import { NueDropdown } from 'nue-ui'
import type { Ref } from 'vue'

type DropdownRef = Ref<InstanceType<typeof NueDropdown> | undefined>

const dropdownPool = new Map<string, DropdownRef[]>()

export default () => {
    const bind = (name: string, dropdownRef: DropdownRef) => {
        const pool = dropdownPool.get(name) || []
        pool.push(dropdownRef)
        dropdownPool.set(name, pool)
    }

    const unBind = (name: string, dropdownRef: DropdownRef) => {
        const pool = dropdownPool.get(name) || []
        if (!pool.length) {
            dropdownPool.delete(name)
            return
        }
        pool.splice(pool.indexOf(dropdownRef), 1)
        dropdownPool.set(name, pool)
    }

    const hideOthers = (name: string) => {
        const pool = dropdownPool.get(name) || []
        if (!pool.length) return
        for (const dropdownRef of pool) {
            if (!dropdownRef.value) continue
            dropdownRef.value.hide()
        }
    }

    return {
        bind,
        unBind,
        hideOthers
    }
}
