<template>
    <nue-dropdown
        close-when-executed
        placement="bottom-end"
        size="small"
        @execute="handleDropdownExecute"
        theme="menu"
        group="tasks-view-operations"
        v-if="viewProps"
    >
        <template #trigger="{ trigger }">
            <nue-button icon="more" theme="icon,ghost" @click="trigger" />
        </template>
        <template #default>
            <nue-div theme="block">
                <nue-text theme="title">切换视图</nue-text>
                <nue-div gap="0.5rem" wrap="nowrap" justify="space-between">
                    <li data-executeid="switch-view-to-table">
                        <nue-icon v-if="$route.name!.toString().endsWith('table')" name="check" />
                        表格
                    </li>
                    <li data-executeid="switch-view-to-kanban">
                        <nue-icon v-if="$route.name!.toString().endsWith('kanban')" name="check" />
                        看板
                    </li>
                    <li data-executeid="switch-view-to-list">
                        <nue-icon v-if="$route.name!.toString().endsWith('list')" name="check" />
                        列表
                    </li>
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div theme="block">
                <nue-text theme="title">视图操作</nue-text>
                <li :data-disabled="isRefreshing" data-executeid="refresh-data">
                    <nue-icon name="refresh" /> 重新获取数据
                </li>
                <li data-executeid="hide-which-is-done">
                    <nue-icon name="eye-close" /> 隐藏已完成
                </li>
                <!--                <inner-dropdown-->
                <!--                    @execute="handleColumnDropdownExecute"-->
                <!--                    title="显示与隐藏列"-->
                <!--                    @click.stop-->
                <!--                    :suffix="sortFieldDropdownOptions.count"-->
                <!--                    group="tasks-view-operations"-->
                <!--                >-->
                <!--                    <inner-dropdown-option-->
                <!--                        v-for="option in sortFieldDropdownOptions.options"-->
                <!--                        :key="option.label"-->
                <!--                        :icon="option.icon"-->
                <!--                        :title="option.label"-->
                <!--                        :execute-id="option.value"-->
                <!--                        :checked="option.checked"-->
                <!--                    />-->
                <!--                </inner-dropdown>-->
            </nue-div>
            <template v-if="viewProps.category === 'project'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">清单操作</nue-text>
                    <li data-executeid="save-as-preference">
                        <nue-icon name="picture" />
                        将当前视图布局保存为偏好
                    </li>
                    <li data-executeid="archive">
                        <nue-icon name="archive" />
                        归档该清单
                    </li>
                    <li data-executeid="delete-project">
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除清单</span>
                    </li>
                </nue-div>
            </template>
            <template v-else-if="viewProps.category === 'tag'">
                <nue-divider />
                <nue-div theme="block">
                    <nue-text theme="title">标签操作</nue-text>
                    <li data-executeid="change-tag-color" v-if="viewProps.extra?.color">
                        <nue-icon name="theme" />
                        修改标签颜色
                        <tag-color-dot
                            :color="viewProps.extra.color as string"
                            style="margin-left: auto"
                            size="small"
                        />
                    </li>
                    <li data-executeid="delete-tag">
                        <nue-icon name="delete" color="#f22" />
                        <span style="color: #f22">删除标签</span>
                    </li>
                </nue-div>
            </template>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
// import { useTodoStore } from '@/stores/global'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { TagColorDot } from '@nao-todo/components'
// import { InnerDropdown, InnerDropdownOption, type InnerDropdownOptionVO } from '@/components/ui'
import { useTasksViewStore, useTasksDataStore, useTasksDialogStore } from '@/stores/tasks'
// import type { TodoColumnOptions } from '@nao-todo/types'
// import { getColumnText } from '@/components/tasks/table/utils'

const router = useRouter()
// const todoStore = useTodoStore()
const tasksViewStore = useTasksViewStore()
const tasksDataStore = useTasksDataStore()
const tasksDialogStore = useTasksDialogStore()

const { viewProps } = storeToRefs(tasksViewStore)
// const { columnOptions } = storeToRefs(todoStore)
const isRefreshing = ref(false)

// const sortFieldDropdownOptions = computed<{
//     options: InnerDropdownOptionVO[]
//     count: number
// }>(() => {
//     const _fields: InnerDropdownOptionVO[] = []
//     let count = 0
//     Object.keys(columnOptions.value).forEach((key) => {
//         const isChecked = columnOptions.value[key as keyof TodoColumnOptions]
//         if (isChecked) count++
//         _fields.push({
//             icon: 'plus-circle',
//             label: getColumnText(key),
//             value: key,
//             checked: isChecked
//         })
//     })
//     return { options: _fields, count }
// })

const handleDropdownExecute = async (executeId: string) => {
    switch (executeId) {
        case 'save-as-preference':
            // await tasksHandlerStore.handleUpdateProjectPreference()
            break
        case 'hide-which-is-done':
            // await tasksHandlerStore.handleHideTodosWhichIsDone()
            break
        case 'switch-view-to-table':
            await router.replace({ name: 'TasksMain', params: { type: 'table' } })
            break
        case 'switch-view-to-kanban':
            await router.replace({ name: 'TasksMain', params: { type: 'kanban' } })
            break
        case 'switch-view-to-list':
            await router.replace({ name: 'TasksMain', params: { type: 'list' } })
            break
        case 'delete-project':
            if (!viewProps.value) break
            await tasksDataStore.deleteProject(viewProps.value.id)
            break
        case 'refresh-data':
            {
                if (viewProps.value!.preference.getTodosOptions) {
                    isRefreshing.value = true
                    await tasksDataStore.getTodos(viewProps.value!.preference.getTodosOptions)
                    isRefreshing.value = false
                }
            }
            break
        case 'change-tag-color':
            if (!tasksDialogStore.tagColorUpdater || !viewProps.value) break
            tasksDialogStore.tagColorUpdater.open({ tagId: viewProps.value.id })
            break
        case 'delete-tag':
            if (!viewProps.value) break
            await tasksDataStore.deleteTag(viewProps.value.id)
            break
    }
}

// const handleColumnDropdownExecute = (field: string) => {
//     const oldValue = columnOptions.value[field as keyof TodoColumnOptions]
//     todoStore.updateColumnOptions({
//         ...columnOptions.value,
//         [field]: !oldValue
//     })
// }
</script>
