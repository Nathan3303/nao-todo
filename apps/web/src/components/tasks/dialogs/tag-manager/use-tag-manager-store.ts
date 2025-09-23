import { computed, reactive } from 'vue'
import useTagsFilter from './use-tags-filter'
import { defineStore } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { useRoute, useRouter } from 'vue-router'
import type { Tag } from '@nao-todo/types'

type FilterInfo = {
    name: string
}

const useTagManagerStore = defineStore('TagManagerStore', () => {
    const tagsFilter = useTagsFilter()
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()
    const router = useRouter()

    const filterInfo = reactive<FilterInfo>({
        name: ''
    })

    // 筛选标签处理函数
    const nameFilterHandler = (tag: Tag) => {
        const name = filterInfo.name
        if (name == '') return true
        return tag.name.includes(name)
    }

    // 筛选标签列表
    const tags = computed(() => {
        return tagsFilter.filter(nameFilterHandler)
    })

    // 处理删除当前标签后路由跳转
    const switchRouteIfDelete = (comparedTagId: Tag['id']) => {
        const tagIdOnRoute = route.params.tagId as string
        if (tagIdOnRoute !== comparedTagId) return
        return router.replace({ name: 'tasks-all' })
    }

    // 删除标签
    const deleteTag = async (tagId: Tag['id']) => {
        const ok = await tasksDataStore.deleteTag(tagId)
        if (ok === 'ok') await switchRouteIfDelete(tagId)
    }

    return {
        tags,
        filterInfo,
        getTagsAgain: tasksDataStore.getTags,
        deleteTag
    }
})

export default useTagManagerStore
