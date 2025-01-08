<template>
    <view id="TodosView" :style="`--menu-button-top:${viewMarginTop}`" class="mp-view">
        <template v-if="authStore.isAuthenticated">
            <tasks-header
                style="position: sticky; top: 0; left: 0"
                @show-menu="showMenu"
                @show-add-todo-panel="showAddTodoPanel"
            />
            <tasks-main />
        </template>
        <template v-else-if="loading"></template>
        <template v-else>
            <view class="tasks-view__un-authenticate">
                <nuem-empty />
            </view>
        </template>
    </view>
    <!-- Popups -->
    <wd-notify />
    <wd-popup
        v-model="visible"
        :custom-style="`width: 64vw; padding-top: ${viewMarginTop}`"
        position="left"
        safe-area-inset-bottom
    >
        <tasks-menu />
    </wd-popup>
    <todo-details :custom-style="`width: 100vw; --menu-button-top: ${viewMarginTop}`" />
    <add-todo-panel ref="addTodoPanelRef" />
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import TasksHeader from './layouts/header.vue'
import TasksMenu from './layouts/menu.vue'
import TasksMain from './layouts/main.vue'
import { useAuthStore } from '@/pages/auth/store'
import { useProjectStore } from './stores/project'
import { useTagStore } from './stores/tag'
import { useTasksViewStore } from './stores/view'
import NuemEmpty from '@/ui/empty.vue'
import AddTodoPanel from '@/pages/tasks/layouts/add-todo-panel/index.vue'
import TodoDetails from './layouts/todo-details/index.vue'

const authStore = useAuthStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const visible = ref(false)
const loading = ref(true)
const addTodoPanelRef = ref()

const showMenu = () => (visible.value = true)
const showAddTodoPanel = () => addTodoPanelRef.value?.show()

const viewMarginTop = computed(() => {
    const { top } = uni.getMenuButtonBoundingClientRect()
    return `calc(${top}px - 1rem)`
})

const checkIsAuthenticated = async () => {
    if (authStore.isAuthenticated) return true
    const checkinResult = await authStore.checkin()
    if (checkinResult && checkinResult.code === 20000) return true
    await uni.redirectTo({ url: '/pages/auth/index' })
    return false
}

onMounted(async () => {
    const checkResult = await checkIsAuthenticated()
    if (!checkResult) return
    await projectStore.getProjects()
    await tagStore.getTags()
    await tasksViewStore.launchTasksView('basic', 'today')
    loading.value = false
    // await todoStore.getTodos()
})
</script>

<style scoped>
@import url('./index.css');
</style>
