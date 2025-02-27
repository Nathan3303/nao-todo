<script setup lang="ts">
import {
    useTasksDialogStore,
    useTasksHandlerStore,
    useTasksViewStore
} from '@/views/index/tasks'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { ref } from 'vue'
import { TagColorDot } from '@nao-todo/components'

const router = useRouter()
const route = useRoute()
const tasksViewStore = useTasksViewStore()
const tasksHandlerStore = useTasksHandlerStore()
const tasksDialogStore = useTasksDialogStore()

const { category, viewInfo } = storeToRefs(tasksViewStore)
const isRefreshing = ref(false)

const handleRefreshData = async () => {
    isRefreshing.value = true
    await tasksHandlerStore.handleGetTodos()
    isRefreshing.value = false
}

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
        case 'delete-project':
            await tasksHandlerStore.handleRemoveProject()
            break
        case 'refresh-data':
            await handleRefreshData()
            break
        case 'change-tag-color':
            await tasksDialogStore.showTagColorSelectDialog()
            break
        case 'delete-tag':
            await tasksHandlerStore.handleDeleteTag()
            break
    }
}
</script>

<template>
    <nue-dropdown
        hide-on-click
        placement="bottom-end"
        size="small"
        @execute="handleDropdownExecute"
        theme="menu"
    >
        <template #default="{ clickTrigger }">
            <nue-button icon="more" theme="icon-only" @click="clickTrigger" />
        </template>
        <template #dropdown>
            <nue-div theme="block" style="min-width: 10rem">
                <nue-text theme="title">切换视图</nue-text>
                <nue-div gap="4px" justify="space-around">
                    <li
                        class="nue-dropdown-item"
                        data-executeid="switch-view-to-table"
                    >
                        <nue-icon
                            v-if="$route.name!.toString().endsWith('table')"
                            name="check"
                        />
                        列表视图
                    </li>
                    <li
                        class="nue-dropdown-item"
                        data-executeid="switch-view-to-kanban"
                    >
                        <nue-icon
                            v-if="$route.name!.toString().endsWith('kanban')"
                            name="check"
                        />
                        看板视图
                    </li>
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <nue-text theme="title">视图操作</nue-text>
                <li
                    class="nue-dropdown-item"
                    :data-disabled="isRefreshing"
                    data-executeid="refresh-data"
                >
                    <nue-icon name="refresh" />
                    重新获取数据
                </li>
                <li
                    class="nue-dropdown-item"
                    data-executeid="hide-which-is-done"
                >
                    <nue-icon name="eye-close" />
                    隐藏已完成
                </li>
            </nue-div>
            <template v-if="category === 'project'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">清单操作</nue-text>
                    <li
                        class="nue-dropdown-item"
                        data-executeid="save-as-preference"
                    >
                        <nue-icon name="picture" />
                        将当前视图布局保存为偏好
                    </li>
                    <li class="nue-dropdown-item" data-executeid="archive">
                        <nue-icon name="archive" />
                        归档该清单
                    </li>
                    <li
                        class="nue-dropdown-item"
                        data-executeid="delete-project"
                    >
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除清单</span>
                    </li>
                </nue-div>
            </template>
            <template v-else-if="category === 'tag'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">标签操作</nue-text>
                    <li
                        class="nue-dropdown-item"
                        data-executeid="change-tag-color"
                    >
                        <nue-icon name="theme" />
                        修改标签颜色
                        <tag-color-dot
                            :color="viewInfo?.payload?.color as string"
                            style="margin-left: auto;"
                            size="small"
                        />
                    </li>
                    <li class="nue-dropdown-item" data-executeid="delete-tag">
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除标签</span>
                    </li>
                </nue-div>
            </template>
        </template>
    </nue-dropdown>
</template>

<style scoped></style>
