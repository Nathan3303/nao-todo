import type { Tag, UpdateTag } from '@nao-todo/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLoadingErrorStoreBase } from '../base'

export default defineStore('TagsStore', () => {
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

    // @storebase 标签存储加载/错误基础
    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    // @returns
    return {
        tags: computed(() => tags.value),
        setTags,
        addTag,
        updateTag,
        getTag,
        loading: computed(() => loading.value),
        error: computed(() => error.value),
        setLoading,
        setError
    }
})
