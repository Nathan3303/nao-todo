<script setup lang="ts">
import { useTasksHandlerStore, useTasksViewStore } from '@/views/index/tasks'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const tasksViewStore = useTasksViewStore()
const tasksHandlerStore = useTasksHandlerStore()

const { category } = storeToRefs(tasksViewStore)

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
            <nue-div theme="block">
                <nue-text theme="title">视图</nue-text>
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
                    data-executeid="hide-which-is-done"
                >
                    <nue-icon name="eye-close" />
                    隐藏已完成
                </li>
                <li
                    class="nue-dropdown-item"
                    data-executeid="archive"
                    v-if="category === 'project'"
                >
                    <nue-icon name="archive" />
                    归档该清单
                </li>
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <li
                    class="nue-dropdown-item"
                    data-executeid="delete-project"
                    v-if="category === 'project'"
                >
                    <nue-icon name="delete" color="#f22" />
                    <span style="color: #f22">删除清单</span>
                </li>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<style scoped></style>
