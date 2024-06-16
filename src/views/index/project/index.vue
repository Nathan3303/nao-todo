<template>
    <project-not-found v-if="!currentProject" />
    <template v-else>
        <nue-div vertical wrap="nowrap" height="100%">
            <project-header
                :project="currentProject"
                @delete-project="handleDeleteProject"
                @add-description="handleAddDescription"
            ></project-header>
            <nue-divider></nue-divider>
            <nue-container style="height: 100%">
                <project-list-header
                    :key="currentProject"
                    @add-todo="handleAddTodo"
                    @filter-todos="handleFilterTodos"
                ></project-list-header>
                <nue-main style="margin: 16px 0 0">
                    <router-view></router-view>
                </nue-main>
            </nue-container>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore, type Project } from '@/stores/useProjectStore'
import { useTodoStore, type Todo } from '@/stores/useTodoStore'
import { findOne } from '@/utils/utils'
import ProjectNotFound from '@/components/project/project-not-found.vue'
import { NueMessage } from 'nue-ui'
import { ProjectHeader, ProjectListHeader } from '@/layers'

defineOptions({ name: 'ProjectView' })
const props = withDefaults(defineProps<{ projectId: string }>(), {})

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const todoStore = useTodoStore()

const addTodoPopupVisible = ref(false)

const currentProject = computed(
    () => findOne(projectStore.projects, (p) => p.id === props.projectId) || null
)

function handleAddTodo(todoName: Todo['name']) {
    todoStore.create(currentProject.value.id, todoName).then(
        () => {
            NueMessage.success('Create todo successfully')
            addTodoPopupVisible.value = false
        },
        (err) => {
            NueMessage.error(err)
            addTodoPopupVisible.value = false
        }
    )
}

function handleFilterTodos(todoName: string) {
    let newQuery = { ...route.query }
    if (todoName === '') {
        delete newQuery.name
    } else {
        newQuery.name = todoName
    }
    router.push({ name: 'list', query: newQuery })
}

function handleDeleteProject() {
    projectStore.remove(currentProject.value.id).then(
        () => NueMessage.success('Project deleted successfully'),
        (err) => NueMessage.error(err)
    )
}

function handleAddDescription(description: Project['description']) {
    projectStore.update(currentProject.value.id, { description }).then(
        () => NueMessage.success('Project description updated successfully'),
        (err) => NueMessage.error(err)
    )
}

onMounted(() => router.replace({ name: 'list' }))
</script>
