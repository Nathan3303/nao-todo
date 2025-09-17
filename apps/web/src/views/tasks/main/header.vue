<template>
    <nue-header>
        <nue-div wrap="nowrap" align="center">
            <nue-div flex="1" wrap="nowrap" align="center">
                <nue-button
                    :icon="pav ? 'menu-close' : 'menu-open'"
                    theme="icon,ghost"
                    @click="handleHideProjectAside"
                />
                <nue-text
                    :clamped="1"
                    theme="pointer"
                    size="var(--nue-text-xxl)"
                    @click="() => viewInfo?.handlers?.updateTitle()"
                >
                    {{ category === 'tag' ? '#' : '' }}
                    {{ viewInfo?.title || '设置清单标题' }}
                </nue-text>
            </nue-div>
            <nue-div wrap="nowrap" align="center" width="fit-content">
                <nue-tooltip
                    content="查看并顺延已过期的待办"
                    size="small"
                    v-if="viewInfo?.id === 'today'"
                >
                    <nue-button icon="history" theme="icon,ghost" @click="handleShowOverdueTodoManager" />
                </nue-tooltip>
                <nue-tooltip content="新增待办" size="small">
                    <nue-button icon="plus" theme="icon,ghost" @click="handleShowTodoCreator" />
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
    </nue-header>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksDialogStore, useTasksHandlerStore, useTasksViewStore } from '../stores'
import { useViewStore } from '@/stores'
import { TasksFilterDropdown, TasksOperationsDropdown } from '@/components/tasks'

defineOptions({ name: 'NaoTasksViewContentHeader' })

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { category, viewInfo } = storeToRefs(tasksViewStore)

const handleHideProjectAside = () => viewStore.toggleProjectAsideVisible()

const handleShowOverdueTodoManager = () => {
    tasksDialogStore.dialogManagerShow('OverdueTodoManager')
}

const handleShowTodoCreator = () => {
    if (!tasksViewStore.viewInfo) return
    tasksDialogStore.dialogManagerShow('TodoCreator', {
        dialogSize: 'small',
        confirmHandler: tasksHandlerStore.handleCreateTodo,
        props: {
            presetInfo: {
                projectId: tasksViewStore.viewInfo.id,
                ...tasksViewStore.viewInfo.createTodoOptions
            }
        }
    })
}
</script>
