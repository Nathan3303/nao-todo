<template>
    <nue-container class="tasks-view" theme="vertical,inner">
        <nue-main
            class="tasks-view__main"
            :allow-collapse-aside="false"
            :allow-collapse-outline="false"
            :allow-hide-aside="false"
            aside-max-width="300px"
            aside-min-width="200px"
            aside-width="240px"
            outline-max-width="600px"
            outline-min-width="400px"
            outline-width="480px"
        >
            <template v-if="pav" #aside>
                <aside-link icon="more2" route-name="tasks-all">所有</aside-link>
                <aside-link icon="calendar2" route-name="tasks-today">
                    今天（ {{ now.format('MM月DD日') }} ）
                </aside-link>
                <aside-link icon="tomorrow2" route-name="tasks-tomorrow">明天</aside-link>
                <aside-link icon="week" route-name="tasks-week">
                    本周（ {{ now.format('dddd') }} ）
                </aside-link>
                <aside-link icon="inbox" route-name="tasks-inbox">收集箱</aside-link>
                <nue-divider />
                <nue-collapse v-model="collapseItemsRecord">
                    <project-smart-list />
                    <tag-smart-list />
                </nue-collapse>
                <nue-divider />
                <aside-link icon="heart" route-name="tasks-favorite">已收藏</aside-link>
                <aside-link icon="delete" route-name="tasks-recycle">垃圾桶</aside-link>
            </template>
            <template #content>
                <suspense>
                    <router-view />
                </suspense>
            </template>
            <template #outline>
                <todo-multi-details
                    v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                    :selected-ids="tasksViewStore.multiSelectStates.selectedTodoIds"
                />
                <todo-details-v2 v-else />
            </template>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ProjectSmartList, TagSmartList, TodoDetailsV2, TodoMultiDetails } from '@/layers'
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { useTasksViewStore } from './stores'
import { AsideLink } from '@nao-todo/components'
import { useMoment } from '@nao-todo/utils'

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()

const now = useMoment()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const collapseItemsRecord = ref(['projects', 'tags', 'filters'])
</script>
