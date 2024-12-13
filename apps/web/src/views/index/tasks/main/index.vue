<template>
    <nue-container class="tasks-main-view" theme="vertical,inner">
        <nue-header class="tasks-main-view__header">
            <todo-view-header>
                <template #actions>
                    <template v-if="category === 'project'">
                        <nue-tooltip content="删除清单" size="small">
                            <nue-button
                                icon="delete"
                                theme="icon-only"
                                @click="viewInfo?.handlers?.remove"
                            />
                        </nue-tooltip>
                    </template>
                    <template v-else-if="category === 'tag'">
                        <nue-tooltip content="修改标签提示色" size="small">
                            <tag-color-dot
                                :color="viewInfo?.payload?.color as string"
                                style="cursor: pointer"
                                @click="tasksDialogStore.showTagColorSelectDialog"
                            />
                        </nue-tooltip>
                        <nue-tooltip content="删除标签" size="small">
                            <nue-button
                                icon="delete"
                                theme="icon-only"
                                @click="viewInfo?.handlers?.remove"
                            />
                        </nue-tooltip>
                    </template>

                    <nue-dropdown
                        hide-on-click
                        placement="bottom-end"
                        size="small"
                        @execute="handleDropdownExecute"
                    >
                        <template #default="{ clickTrigger }">
                            <nue-button icon="more" theme="icon-only" @click="clickTrigger" />
                        </template>
                        <template #dropdown>
                            <template v-if="category === 'project'">
                                <li class="nue-dropdown-item" data-executeid="save-as-preference">
                                    将当前视图保存为偏好
                                </li>
                                <li class="nue-dropdown-item" data-executeid="archive">
                                    归档该清单
                                </li>
                            </template>
                            <template v-else>
                                <li class="nue-dropdown-item" data-executeid="hide-which-is-done">
                                    <nue-icon name="eye-close" />
                                    隐藏已完成
                                </li>
                            </template>
                        </template>
                    </nue-dropdown>
                </template>
                <template #navigations>
                    <nue-link :route="{ name: `tasks-${$route.meta.id}-table` }" theme="btnlike">
                        列表视图
                    </nue-link>
                    <nue-link :route="{ name: `tasks-${$route.meta.id}-kanban` }" theme="btnlike">
                        看板视图
                    </nue-link>
                </template>
            </todo-view-header>
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
import { TodoViewHeader } from '@/layers'
import { TagColorDot } from '@nao-todo/components'
import { useTasksDialogStore, useTasksHandlerStore, useTasksViewStore } from '..'

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const { category, viewInfo } = storeToRefs(tasksViewStore)

// 清单操作菜单处理函数
const handleDropdownExecute = async (executeId: string) => {
    switch (executeId) {
        case 'save-as-preference':
            await tasksHandlerStore.handleUpdateProjectPreference()
            break
        case 'archive':
            await tasksHandlerStore.handleArchiveProject()
            break
        case 'hide-which-is-done':
            await tasksHandlerStore.handleHideTodosWhichIsDone()
            break
    }
}

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
