<template>
    <nue-container id="TaskMultiDetails" theme="vertical,inner">
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
            <nue-div flex="1" vertical>
                <nue-div align="center">
                    <task-date-selector
                        v-model="commonData.dueDate.endAt"
                        @change="handleChangeEndDate"
                    />
                    <nue-text v-if="commonData.dueDate.endAt" color="gray" size="12px">
                        (截止于 {{ parse2RelativeDate(commonData.dueDate.endAt) }} )
                    </nue-text>
                </nue-div>
                <nue-divider />
                <nue-div align="center" wrap="nowrap">
                    <task-selector
                        :options="TaskStateSelectOptions"
                        :value="commonData.state"
                        placeholder="待办状态"
                        @change="handleChangeState"
                    />
                    <task-selector
                        :options="TaskPrioritySelectOptions"
                        :value="commonData.priority"
                        placeholder="待办优先级"
                        @change="handleChangePriority"
                    />
                </nue-div>
                <nue-div flex="1" />
                <task-tag-bar
                    :tags="avalibleTags"
                    :task-tags="commonData.tags"
                    @update-tags="handleUpdateTags"
                />
            </nue-div>
        </nue-main>
        <nue-footer style="justify-content: space-between">
            <task-project-selector
                :project-id="commonData.projectId"
                :projects="avalibleProjects"
                placeholder="移动到清单"
                @select="
                    (pId: string, pTitle: string | undefined) => setProjectInfo(pId, pTitle || '')
                "
            />
            <nue-div width="auto">
                <nue-button icon="delete" size="small" theme="error" @click="handleDelete">
                    永久删除
                </nue-button>
                <task-delete-button
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
import { parse2RelativeDate } from '@nao-todo/infrastructure/utils/relative-date-parser'
import {
    TaskDateSelector,
    TaskProjectSelector,
    TaskTagBar,
    TaskDeleteButton,
    TaskSelector
} from '@nao-todo/components'
import {
    TaskStateSelectOptions,
    TaskPrioritySelectOptions
} from '@nao-todo/infrastructure/consts/tasks'
import type { TaskMultiDetailsProps } from './types'

const props = defineProps<TaskMultiDetailsProps>()

const {
    avalibleProjects,
    avalibleTags,
    commonData,
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

