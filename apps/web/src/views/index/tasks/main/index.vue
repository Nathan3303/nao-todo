<template>
    <nue-container class="tasks-main-view" theme="vertical,inner">
        <nue-header class="tasks-main-view__header">
            <todo-view-header>
                <template #actions>
                    <template
                        v-if="category === 'basic' && viewInfo?.id === 'today'"
                    >
                        <nue-tooltip
                            content="查看并顺延已过期的待办"
                            size="small"
                        >
                            <nue-button
                                icon="history"
                                theme="icon-only"
                                @click="
                                    () =>
                                        tasksDialogStore.dialogManagerShow(
                                            'OverdueTodoManager'
                                        )
                                "
                            />
                        </nue-tooltip>
                    </template>
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
                        <nue-tooltip
                            content="修改标签提示色"
                            size="small"
                            style="margin-right: 12px"
                        >
                            <tag-color-dot
                                :color="viewInfo?.payload?.color as string"
                                style="cursor: pointer"
                                @click="
                                    tasksDialogStore.showTagColorSelectDialog
                                "
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
                        placement="bottom-end"
                        size="small"
                        theme="menu"
                    >
                        <template #default="{ clickTrigger }">
                            <nue-button
                                icon="filter"
                                theme="icon-only"
                                @click="clickTrigger"
                            />
                        </template>
                        <template #dropdown>
                            <nue-div theme="block">
                                <nue-text theme="title">过滤</nue-text>
                            </nue-div>
                            <nue-divider />
                            <nue-div theme="block">
                                <nue-text theme="title">排序</nue-text>
                                <todo-table-order-bar @click.stop />
                            </nue-div>
                        </template>
                    </nue-dropdown>
                    <nue-dropdown
                        hide-on-click
                        placement="bottom-end"
                        size="small"
                        @execute="handleDropdownExecute"
                        theme="menu"
                    >
                        <template #default="{ clickTrigger }">
                            <nue-button
                                icon="more"
                                theme="icon-only"
                                @click="clickTrigger"
                            />
                        </template>
                        <template #dropdown>
                            <nue-div theme="block">
                                <nue-text theme="title">视图</nue-text>
                                <nue-div gap="4px" justify="space-around">
                                    <li
                                        class="nue-dropdown-item"
                                        data-executeid="switch-view-to-table"
                                    >
                                        <nue-icon
                                            v-if="
                                                $route
                                                    .name!.toString()
                                                    .endsWith('table')
                                            "
                                            name="check"
                                        />
                                        列表视图
                                    </li>
                                    <li
                                        class="nue-dropdown-item"
                                        data-executeid="switch-view-to-kanban"
                                    >
                                        <nue-icon
                                            v-if="
                                                $route
                                                    .name!.toString()
                                                    .endsWith('kanban')
                                            "
                                            name="check"
                                        />
                                        看板视图
                                    </li>
                                </nue-div>
                            </nue-div>
                            <nue-divider />
                            <nue-div theme="block">
                                <nue-text theme="title">操作</nue-text>
                                <li
                                    class="nue-dropdown-item"
                                    data-executeid="save-as-preference"
                                    v-if="category === 'project'"
                                >
                                    <nue-icon name="picture" />
                                    将当前视图布局保存为偏好
                                </li>
                                <li
                                    class="nue-dropdown-item"
                                    data-executeid="archive"
                                    v-if="category === 'project'"
                                >
                                    <nue-icon name="archive" />
                                    归档该清单
                                </li>
                                <li
                                    class="nue-dropdown-item"
                                    data-executeid="hide-which-is-done"
                                >
                                    <nue-icon name="eye-close" />
                                    隐藏已完成
                                </li>
                            </nue-div>
                        </template>
                    </nue-dropdown>
                </template>
                <!--                <template #navigations>-->
                <!--                    <nue-link :route="{ name: `tasks-${$route.meta.id}-table` }" theme="btnlike">-->
                <!--                        列表视图-->
                <!--                    </nue-link>-->
                <!--                    <nue-link :route="{ name: `tasks-${$route.meta.id}-kanban` }" theme="btnlike">-->
                <!--                        看板视图-->
                <!--                    </nue-link>-->
                <!--                </template>-->
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
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router'
import { TodoViewHeader, TodoTableOrderBar } from '@/layers'
import { TagColorDot } from '@nao-todo/components'
import {
    useTasksDialogStore,
    useTasksHandlerStore,
    useTasksViewStore
} from '..'

const router = useRouter()
const route = useRoute()
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
        case 'switch-view-to-table':
            await router.replace({ name: `tasks-${route.meta.id}-table` })
            break
        case 'switch-view-to-kanban':
            await router.replace({ name: `tasks-${route.meta.id}-kanban` })
            break
    }
}

// 处理路由重复问题
onBeforeRouteUpdate((to, from, next) => {
    const toName = (to.name as string).split('-').slice(0, 2).join('-')
    const fromName = from.name as string
    if (
        (fromName.endsWith('kanban') || fromName.endsWith('table')) &&
        to.name === toName
    ) {
        if (
            category.value === 'project' &&
            to.params.projectId !== from.params.projectId
        ) {
            return next()
        }
        if (category.value === 'tag' && to.params.tagId !== from.params.tagId) {
            return next()
        }
        return next(false)
    }
    next()
})

// 判断是否是 “今日视图” 且首次打开，是则显示过期任务处理对话框
// onBeforeRouteUpdate((to, from, next) => {
//     if (!viewInfo.value) return
//     if (viewInfo.value.id !== 'today') return
//     const lastTimeOpenedTodayView = localStorage.getItem('lastTimeOpenedTodayView')
//     const now = useMoment()
//     if (!lastTimeOpenedTodayView || now.isBefore(lastTimeOpenedTodayView, 'd')) {
//         requestIdleCallback(() => {
//             setTimeout(() => tasksDialogStore.showTodoHistoryDialog(true), 128)
//             localStorage.setItem('lastTimeOpenedTodayView', now.toISOString(true))
//         })
//     }
// })

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
