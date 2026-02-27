import type { Tag, UpdateTag } from '@nao-todo/types'
import { computed, ref } from 'vue'

const useTagsStoreBase = () => {
    // @state 标签列表
    const tags = ref<Tag[]>([])

    // @computed 标签视图对象 Map
    const tagsMap = computed(() => {
        return new Map(tags.value.map((item) => [item.id, item]))
    })

    // @action 设置标签视图对象数组
    const setTags = (newTags: Tag[]) => {
        tags.value = newTags
    }

    // @action 添加标签
    const addTag = (t: Tag) => {
        const isExist = tagsMap.value.has(t.id)
        if (isExist) return
        tags.value.push(t)
    }

    // @action 更新标签
    const updateTag = (id: Tag['id'], t: UpdateTag) => {
        const idx = tags.value.findIndex((item) => item.id === id)
        if (idx === -1) return
        tags.value[idx] = { ...tags.value[idx], ...t }
    }

    // @action 获取单个标签
    const getTag = (id: Tag['id']) => {
        return tagsMap.value.get(id)
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

export default useTagsStoreBase
export type TagsStoreBase = ReturnType<typeof useTagsStoreBase>
