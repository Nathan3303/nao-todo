<template>
    <nue-container id="tasks/main" theme="vertical,inner">
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
                            <li class="nue-dropdown-item" data-executeid="save-as-preference">
                                将当前视图保存为偏好
                            </li>
                            <li class="nue-dropdown-item" data-executeid="archive">归档该清单</li>
                        </template>
                    </nue-dropdown>
                </template>
                <template v-else-if="category === 'tag'">
                    <nue-tooltip content="修改标签提示色" size="small">
                        <tag-color-dot
                            :color="viewInfo?.payload?.color as string"
                            style="cursor: pointer; width: 13px"
                            @click="showUpdateColorDialog"
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
        <nue-main style="border: none">
            <suspense>
                <router-view />
            </suspense>
        </nue-main>
    </nue-container>
    <tag-color-select-dialog ref="tagColorSelectDialogRef" :handler="tagStore.updateTagColor" />
</template>

<script lang="ts" setup>
import { ref, watchEffect } from 'vue'
import { TodoViewHeader } from '@/layers'
import { useTagStore } from '@/stores'
import { useTasksViewStore } from '../stores'
import { storeToRefs } from 'pinia'
import { onBeforeRouteUpdate } from 'vue-router'
import { TagColorDot, TagColorSelectDialog } from '@nao-todo/components'

const tasksViewStore = useTasksViewStore()
const tagStore = useTagStore()

const { category, viewInfo } = storeToRefs(tasksViewStore)
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()

// 显示标签颜色选择对话框
const showUpdateColorDialog = async () => {
    if (!viewInfo.value) return
    tagColorSelectDialogRef.value?.show(viewInfo.value.id, viewInfo.value.payload?.color as string || 'transparent')
}

// 清单操作菜单处理函数
const handleDropdownExecute = async (executeId: string) => {
    switch (executeId) {
        case 'save-as-preference':
            await tasksViewStore.handleUpdateProjectPreference()
            break
        case 'archive':
            await tasksViewStore.handleArchiveProject()
            break
    }
}

// 处理路由重复问题
onBeforeRouteUpdate((to, from, next) => {
    // console.log(to, from)
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

watchEffect(async () => await tasksViewStore.getViewInfo())
</script>
