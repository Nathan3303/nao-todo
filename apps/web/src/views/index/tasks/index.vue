<template>
    <nue-main
        style="z-index: 0"
        aside-width="240px"
        aside-min-width="200px"
        aside-max-width="300px"
        :allow-collapse-aside="false"
        :allow-hide-aside="false"
        outline-width="480px"
        outline-min-width="400px"
        outline-max-width="600px"
        :allow-collapse-outline="false"
    >
        <template #aside v-if="pav">
            <aside-link icon="more2" route-name="tasks-all">所有</aside-link>
            <aside-link icon="calendar2" route-name="tasks-today">今天</aside-link>
            <aside-link icon="tomorrow2" route-name="tasks-tomorrow">明天</aside-link>
            <aside-link icon="week" route-name="tasks-week">最近 7 天</aside-link>
            <aside-link icon="inbox" route-name="tasks-inbox">收集箱</aside-link>
            <nue-divider />
            <nue-collapse v-model="collapseItemsRecord">
                <project-smart-list />
                <!-- <todo-filter-list /> -->
                <!-- <tag-smart-list /> -->
            </nue-collapse>
            <nue-divider />
            <aside-link icon="heart" route-name="tasks-favorite">已收藏</aside-link>
            <aside-link icon="delete" route-name="tasks-recycle">垃圾桶</aside-link>
        </template>
        <template #content>
            <router-view />
        </template>
        <template #outline>
            <todo-multi-details v-if="isShowMultiDetails" :selected-ids="selectedIds" />
            <todo-details-v2 v-else />
        </template>
    </nue-main>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import { TodoDetailsV2, ProjectSmartList, TodoMultiDetails } from '@/layers'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { AsideLink } from '@nao-todo/components'
import { TasksViewContextKey } from './constants'
import type { Todo } from '@nao-todo/types'
import type { TasksViewContext } from './types'

const viewStore = useViewStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const collapseItemsRecord = ref(['projects', 'tags', 'filters'])
const isShowMultiDetails = ref(false)
const selectedIds = ref<Todo['id'][]>([])

const handleShowMultiDetails = (_selectedIds: Todo['id'][]) => {
    isShowMultiDetails.value = true
    selectedIds.value = _selectedIds
}

provide<TasksViewContext>(TasksViewContextKey, {
    isShowMultiDetails,
    handleShowMultiDetails,
    handleHideMultiDetails: () => (isShowMultiDetails.value = false)
})
</script>

<style scoped>
@import url('./index.css');
</style>
