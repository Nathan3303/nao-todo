<template>
    <view class="tasks-menu">
        <view class="tasks-manu__basic-view-links">
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('all')"
                icon="more2"
                @click="tasksViewStore.launchTasksView('basic', 'all')"
            >
                所有
            </nuem-button>
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('today')"
                icon="calendar2"
                @click="tasksViewStore.launchTasksView('basic', 'today')"
            >
                今天
            </nuem-button>
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('tomorrow')"
                icon="tomorrow2"
                @click="tasksViewStore.launchTasksView('basic', 'tomorrow')"
            >
                明天
            </nuem-button>
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('week')"
                icon="week3"
                @click="tasksViewStore.launchTasksView('basic', 'week')"
            >
                本周
            </nuem-button>
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('inbox')"
                icon="inbox"
                @click="tasksViewStore.launchTasksView('basic', 'inbox')"
            >
                收集箱
            </nuem-button>
        </view>
        <view v-if="projects.length" class="tasks-manu__basic-view-links">
            <nuem-button
                v-for="project in projects"
                :key="project.id + tasksViewStore.viewId"
                :theme="setActived(project.id)"
                icon="more2"
                style="--icon-color: orange"
                @click="tasksViewStore.launchTasksView('project', project.id)"
            >
                {{ project.title }}
            </nuem-button>
        </view>
        <view v-if="tags.length" class="tasks-manu__basic-view-links">
            <nuem-button
                v-for="tag in tags"
                :key="tag.id + tasksViewStore.viewId"
                :theme="setActived(tag.id)"
                icon="tag"
                style="--icon-color: orange"
                @click="tasksViewStore.launchTasksView('tag', tag.id)"
            >
                {{ tag.name }}
            </nuem-button>
        </view>
        <view class="tasks-manu__basic-view-links">
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('favorite')"
                icon="heart"
                @click="tasksViewStore.launchTasksView('basic', 'favorite')"
            >
                已收藏
            </nuem-button>
            <nuem-button
                :key="tasksViewStore.viewId"
                :theme="setActived('recycle')"
                icon="delete"
                @click="tasksViewStore.launchTasksView('basic', 'recycle')"
            >
                垃圾桶
            </nuem-button>
        </view>
        <view class="tasks-menu__footer">
            <nuem-button icon="plus-circle" theme="rl">新增</nuem-button>
        </view>
    </view>
</template>

<script lang="ts" setup>
import NuemButton from '@/ui/button.vue'
import { useTasksViewStore } from '@/pages/tasks/stores/view'
import { useProjectStore } from '@/pages/tasks/stores/project'
import { useTagStore } from '@/pages/tasks/stores/tag'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMenu' })

const tasksViewStore = useTasksViewStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const { smartListData: projects } = storeToRefs(projectStore)
const { smartListData: tags } = storeToRefs(tagStore)

const setActived = (viewIdToCheck: string) => {
    return viewIdToCheck === tasksViewStore.viewId ? `rl,pri` : `rl`
}
</script>

<style scoped>
.tasks-menu {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    padding: 1rem;
    gap: 0.25rem;
    height: 100%;
}

.tasks-manu__basic-view-links {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
}

.tasks-menu__footer {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}
</style>
