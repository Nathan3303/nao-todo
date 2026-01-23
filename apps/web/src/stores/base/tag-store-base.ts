import type { Tag, UpdateTag } from '@nao-todo/types'
import { ref } from 'vue'

const useTagStoreBase = () => {
    // @state 标签视图对象 Map
    const tags = ref<Map<Tag['id'], Tag>>(new Map())

    // @action 设置标签视图对象数组
    const setTags = (value: Tag[]) => {
        tags.value = new Map(value.map((item) => [item.id, item]))
    }

    // @action 添加标签
    const addTag = (t: Tag) => {
        const idx = tags.value.has(t.id)
        if (idx) return
        tags.value.set(t.id, t)
    }

    // @action 更新标签
    const updateTag = (id: Tag['id'], t: UpdateTag) => {
        const idx = tags.value.has(id)
        if (!idx) return
        tags.value.set(id, { ...tags.value.get(id)!, ...t })
    }

    // @action 获取单个标签
    const getTag = (id: Tag['id']) => {
        return tags.value.get(id)
    }

    // @returns
    return {
        tags,
        setTags,
        addTag,
        updateTag,
        getTag
    }
}

export default useTagStoreBase
export type TagStoreBase = ReturnType<typeof useTagStoreBase>
