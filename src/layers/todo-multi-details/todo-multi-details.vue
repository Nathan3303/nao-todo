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
            <nue-button icon="clear" size="small">取消选择</nue-button>
        </nue-header>
        <nue-main>
            <nue-div style="margin-bottom: 16px" align="center" gap="0px">
                <nue-text size="12px">任务过期时间：</nue-text>
                <todo-date-selector v-model="endDate" />
            </nue-div>
            <nue-div>
                <todo-selector
                    :value="commonData.priority"
                    :options="[
                        { label: '低优先级', value: 'low' },
                        { label: '中优先级', value: 'medium' },
                        { label: '高优先级', value: 'high' }
                    ]"
                    @change="(p) => (commonData.priority = p as string)"
                />
                <todo-selector
                    :value="commonData.state"
                    :options="[
                        { label: '代办', value: 'todo' },
                        { label: '正在进行', value: 'in-progress' },
                        { label: '已完成', value: 'done' }
                    ]"
                    @change="(s) => (commonData.state = s as string)"
                />
            </nue-div>
            <nue-div flex />
            <nue-div>
                <todo-tag-bar
                    :tags="tagStore.tags"
                    :todo-tags="commonData.tags"
                    @update-tags="handleUpdateTags"
                />
            </nue-div>
        </nue-main>
        <nue-footer style="justify-content: space-between">
            <todo-project-selector
                :user-id="userStore.user!.id"
                :projects="avalibleProjects"
                :project-id="commonData.projectId"
                :project-title="commonData.project.title"
                @select="setProjectInfo"
            />
            <todo-delete-button />
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
    TodoDateSelector,
    TodoSelector,
    TodoProjectSelector,
    TodoTagBar,
    TodoDeleteButton
} from '@/components'
import { useUserStore, useProjectStore, useTagStore } from '@/stores'
import type { TodoMultiDetailsProps } from './types'

defineOptions({ name: 'TodoMultiDetails' })
defineProps<TodoMultiDetailsProps>()

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const avalibleProjects = computed(() => {
    return projectStore._toFiltered({ isDeleted: false, isArchived: false })
})

const commonData = reactive({
    dueDate: { endAt: '' },
    priority: 'low',
    state: 'todo',
    projectId: userStore.user!.id,
    project: { title: '' },
    tags: ['']
})

const endDate = computed({
    get() {
        if (!commonData.dueDate.endAt) return ''
        const sliced = commonData.dueDate.endAt!.slice(0, 16)
        return sliced
    },
    set(value) {
        commonData.dueDate.endAt = value
    }
})

const setProjectInfo = (projectId: string, projectTitle: string) => {
    commonData.projectId = projectId
    commonData.project.title = projectTitle
}

const handleUpdateTags = (tags: string[]) => {
    commonData.tags = tags
}
</script>

<style scoped></style>
