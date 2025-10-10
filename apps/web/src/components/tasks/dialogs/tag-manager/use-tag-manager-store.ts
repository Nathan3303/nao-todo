import { watch, reactive, ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { useTasksDataStore } from '@/stores/tasks'
import { useRoute, useRouter } from 'vue-router'
import type { Tag } from '@nao-todo/types'

type FilterInfo = {
    name: string
}

const useTagManagerStore = defineStore('TagManagerStore', () => {
    const tasksDataStore = useTasksDataStore()
    const route = useRoute()
    const router = useRouter()

    const { tags: tagsRaw } = storeToRefs(tasksDataStore)

    const tags = ref<Tag[]>([])

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
    const loadTags = () => {
        const handler = [nameFilterHandler]
        tags.value = tagsRaw.value.filter((tag) => {
            return handler.every((handler) => handler(tag))
        }) as Tag[]
    }

    // 处理删除当前标签后路由跳转
    const switchRouteIfDelete = (comparedTagId: Tag['id']) => {
        const tagIdOnRoute = route.params.tagId as string
        if (tagIdOnRoute !== comparedTagId) return
        return router.replace({ name: 'tasks-all' })
    }

    // 删除标签
    const deleteTag = async (tagId: Tag['id']) => {
        await tasksDataStore.deleteTag(tagId)
        await switchRouteIfDelete(tagId)
    }

    // 监听过滤选项变化，重新加载数据
    watch(
        () => filterInfo && tagsRaw.value,
        () => loadTags(),
        { deep: true }
    )

    return {
        tags,
        filterInfo,
        loadTags,
        getTagsAgain: tasksDataStore.getTags,
        deleteTag
    }
})

export default useTagManagerStore
