<template>
    <nue-container id="TodoMultiDetails" theme="vertical,inner">
        <nue-header height="auto" style="box-sizing: border-box">
            <nue-text size="16px" style="margin-right: auto">
                已选中列表中的
                <nue-text color="orange" size="16px">
                    {{ selectedIds?.length || 0 }}
                </nue-text>
                个待办事项
            </nue-text>
            <nue-button icon="clear" size="small" @click="handleCancelMultiSelect">关闭</nue-button>
        </nue-header>
        <nue-main>
            <nue-div flex vertical>
                <nue-div align="center">
                    <todo-date-selector
                        v-model="commonData.dueDate.endAt"
                        @change="handleChangeEndDate"
                    />
                    <nue-text v-if="commonData.dueDate.endAt" color="gray" size="12px">
                        (截止于 {{ useRelativeDate(commonData.dueDate.endAt) }} )
                    </nue-text>
                </nue-div>
                <nue-divider />
                <nue-div align="center" wrap="nowrap">
                    <todo-selector
                        :options="TodoStateSelectOptions"
                        :value="commonData.state"
                        placeholder="待办状态"
                        @change="handleChangeState"
                    />
                    <todo-selector
                        :options="TodoPrioritySelectOptions"
                        :value="commonData.priority"
                        placeholder="待办优先级"
                        @change="handleChangePriority"
                    />
                </nue-div>
                <nue-div flex />
                <todo-tag-bar
                    :tags="avalibleTags"
                    :todo-tags="commonData.tags"
                    @update-tags="handleUpdateTags"
                />
            </nue-div>
        </nue-main>
        <nue-footer style="justify-content: space-between">
            <todo-project-selector
                :project-id="commonData.projectId"
                :projects="avalibleProjects"
                :user-id="userStore.user!.id"
                placeholder="移动到清单"
                @select="setProjectInfo"
            />
            <nue-div width="auto">
                <nue-button icon="delete" size="small" theme="error" @click="handleDelete">
                    永久删除
                </nue-button>
                <todo-delete-button
                    :is-deleted="commonData.isDeleted"
                    @delete="handleRemove"
                    @restore="handleRestore"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { useMultiDetails } from './use-multi-details'
import { useRelativeDate } from '@nao-todo/hooks/use-relative-date'
import {
    TodoDateSelector,
    TodoProjectSelector,
    TodoTagBar,
    TodoDeleteButton
} from '@nao-todo/components'
import {
    TodoSelector,
    TodoStateSelectOptions,
    TodoPrioritySelectOptions
} from '@nao-todo/components/todo/selector'
import type { TodoMultiDetailsProps } from './types'

const props = defineProps<TodoMultiDetailsProps>()

const {
    avalibleProjects,
    avalibleTags,
    commonData,
    userStore,
    setProjectInfo,
    handleChangeEndDate,
    handleUpdateTags,
    handleChangeState,
    handleChangePriority,
    handleRemove,
    handleRestore,
    handleDelete,
    handleCancelMultiSelect
} = useMultiDetails(props)
</script>
