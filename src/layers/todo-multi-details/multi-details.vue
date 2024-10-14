<template>
    <nue-container theme="vertical,inner" id="TodoMultiDetails">
        <nue-header height="auto" style="box-sizing: border-box">
            <nue-text size="16px" style="margin-right: auto">
                已选中列表中的
                <nue-text size="16px" color="orange">
                    {{ selectedIds?.length || 0 }}
                </nue-text>
                个待办事项
            </nue-text>
            <nue-button icon="clear" size="small">关闭</nue-button>
        </nue-header>
        <nue-main>
            <nue-div vertical>
                <nue-div align="center">
                    <todo-date-selector v-model="endDate" @change="handleChangeEndDate" />
                    <nue-text v-if="endDate" size="12px" color="gray">
                        ( {{ useRelativeDate(endDate) }} )
                    </nue-text>
                </nue-div>
                <nue-divider />
                <nue-div align="center" wrap="nowrap">
                    <todo-selector
                        placeholder="待办状态"
                        :value="commonData.state"
                        :options="stateOptions"
                        @change="handleChangeState"
                    />
                    <todo-selector
                        placeholder="待办优先级"
                        :value="commonData.priority"
                        :options="priorityOptions"
                        @change="handleChangePriority"
                    />
                    <nue-div flex />
                    <todo-project-selector
                        placeholder="移动到清单"
                        :user-id="userStore.user!.id"
                        :projects="avalibleProjects"
                        :project-id="commonData.projectId"
                        :project-title="commonData.project.title"
                        @select="setProjectInfo"
                    />
                </nue-div>
                <nue-divider />
                <todo-tag-bar
                    :tags="avalibleTags"
                    :todo-tags="commonData.tags"
                    @update-tags="handleUpdateTags"
                />
            </nue-div>
        </nue-main>
        <nue-footer style="justify-content: space-between">
            <todo-delete-button
                :is-deleted="commonData.isDeleted"
                @delete="handleRemove"
                @restore="handleRestore"
            />
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import {
    TodoDateSelector,
    TodoSelector,
    TodoProjectSelector,
    TodoTagBar,
    TodoDeleteButton
} from '@/components'
import type { TodoMultiDetailsProps } from './types'
import { useMultiDetails } from './use-multi-details'
import { useRelativeDate } from '@/hooks/use-relative-date'

defineOptions({ name: 'TodoMultiDetails' })
const props = defineProps<TodoMultiDetailsProps>()

const {
    avalibleProjects,
    avalibleTags,
    commonData,
    endDate,
    userStore,
    priorityOptions,
    stateOptions,
    setProjectInfo,
    handleChangeEndDate,
    handleUpdateTags,
    handleChangeState,
    handleChangePriority,
    handleRemove,
    handleRestore
} = useMultiDetails(props)
</script>

<style scoped></style>
