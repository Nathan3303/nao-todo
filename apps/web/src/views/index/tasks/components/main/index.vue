<template>
    <nue-container class="tasks-main-view" theme="vertical,inner">
        <nue-header class="tasks-main-view__header">
            <nue-div class="tasks-main-view__header__title-bar">
                <nue-div wrap="nowrap">
                    <nue-div class="tasks-main-view__header__title-bar__title">
                        <nue-tooltip
                            :content="`${pav ? '收起' : '展开'}菜单侧栏`"
                            placement="top-start"
                            size="small"
                        >
                            <nue-button
                                :icon="pav ? 'menu-close' : 'menu-open'"
                                theme="icon-only"
                                @click="handleHideProjectAside"
                            />
                        </nue-tooltip>
                        <nue-text
                            :clamped="1"
                            size="24px"
                            theme="pointer"
                            @click="() => viewInfo?.handlers?.updateTitle()"
                        >
                            {{ category === 'tag' ? '#' : '' }}
                            {{ viewInfo?.title || '设置清单标题' }}
                        </nue-text>
                    </nue-div>
                    <nue-div class="tasks-main-view__header__title-bar__actions">
                        <nue-tooltip
                            content="查看并顺延已过期的待办"
                            size="small"
                            v-if="viewInfo?.id === 'today'"
                        >
                            <nue-button
                                icon="history"
                                theme="icon-only"
                                @click="
                                    () => tasksDialogStore.dialogManagerShow('OverdueTodoManager')
                                "
                            />
                        </nue-tooltip>
                        <nue-tooltip content="新增待办" size="small">
                            <nue-button
                                icon="plus"
                                theme="icon-only"
                                @click="tasksDialogStore.showCreateTodoDialog"
                            />
                        </nue-tooltip>
                        <tasks-filter-dropdown />
                        <tasks-operations-dropdown />
                    </nue-div>
                </nue-div>
                <nue-text
                    v-if="category === 'project'"
                    color="gray"
                    size="14px"
                    theme="pointer"
                    @click="() => viewInfo?.handlers?.updateDescription()"
                    :clamped="2"
                >
                    {{ viewInfo?.description || '该清单没有设置描述信息，点此设置清单描述' }}
                </nue-text>
            </nue-div>
        </nue-header>
        <nue-main class="tasks-main-view__main">
            <router-view />
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteUpdate } from 'vue-router'
import { useTasksDialogStore, useTasksViewStore } from '../../stores'
import { TasksFilterDropdown, TasksOperationsDropdown } from '../dropdowns'
import { useViewStore } from '@/stores'
import type { Project, Tag } from '@nao-todo/types'

defineOptions({ name: 'ContentHeader' })
defineProps<{
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}>()

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { category, viewInfo } = storeToRefs(tasksViewStore)

const handleHideProjectAside = () => viewStore.toggleProjectAsideVisible()

// 处理路由重复问题
onBeforeRouteUpdate((to, from, next) => {
    const toName = (to.name as string).split('-').slice(0, 2).join('-')
    const fromName = from.name as string
    if ((fromName.endsWith('kanban') || fromName.endsWith('table')) && to.name === toName) {
        if (category.value === 'project' && to.params.projectId !== from.params.projectId) {
            return next()
        }
        if (category.value === 'tag' && to.params.tagId !== from.params.tagId) {
            return next()
        }
        return next(false)
    }
    next()
})

// 获取视图信息
watchEffect(() => tasksViewStore.getViewInfo())
</script>

<style>
.tasks-main-view {
    box-sizing: border-box;
    min-width: 375px;

    .tasks-main-view__header {
        box-sizing: border-box;
        height: auto;
        flex-direction: column;
        gap: 16px;
    }

    .tasks-main-view__header__title-bar {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 4px;

        .tasks-main-view__header__title-bar__title {
            align-items: center;
            width: auto;
            flex: 1 1 auto;
            flex-wrap: nowrap;
            gap: 8px;
        }

        .tasks-main-view__header__title-bar__actions {
            align-items: center;
            width: auto;
            flex-shrink: 0;
            gap: 8px;
        }
    }

    .tasks-main-view__main {
        border: none !important;
    }
}
</style>
