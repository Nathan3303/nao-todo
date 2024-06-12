<template>
    <!-- Show when project is not found -->
    <project-not-found v-if="!currentProject" />

    <!-- Show when project is found -->
    <template v-else>
        <nue-div vertical wrap="nowrap" height="100%">
            <!-- Project title -->
            <nue-div align="center" justify="space-between" wrap="nowrap">
                <nue-div vertical gap="4px" flex>
                    <nue-text size="24px" weight="bold"> {{ currentProject.name }} </nue-text>
                    <nue-text size="12px" color="gray">
                        {{ currentProject.description }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" justify="end" flex gap="8px">
                    <nue-text size="12px">Create by</nue-text>
                    <nue-avatar
                        src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                    ></nue-avatar>
                </nue-div>
            </nue-div>

            <!-- Project navigation -->
            <nue-div style="margin-top: 16px" justify="space-between" wrap="nowrap" align="center">
                <nue-div flex>
                    <nue-link theme="btnlike" disabled> Dashboard </nue-link>
                    <nue-link theme="btnlike" route="board"> Board </nue-link>
                    <nue-link theme="btnlike" disabled> List </nue-link>
                    <nue-link theme="btnlike" disabled> Timeline </nue-link>
                    <nue-link theme="btnlike" disabled> Menbers </nue-link>
                    <nue-link theme="btnlike" disabled> Files </nue-link>
                </nue-div>
                <nue-div flex width="fit-content">
                    <nue-button theme="pure" icon="delete" @click="handleDeleteProject">
                        Delete
                    </nue-button>
                </nue-div>
            </nue-div>

            <nue-divider></nue-divider>

            <!-- Project sub-view -->
            <nue-container style="height: 100%">
                <!-- sub-view header -->
                <nue-header style="padding: 0; border: none; height: fit-content">
                    <nue-div align="center" justify="space-between" wrap="nowrap" gap="16px">
                        <nue-div wrap="nowrap" flex="none" width="fit-content" gap="12px">
                            <nue-input
                                theme="small"
                                v-model="filterValue"
                                placeholder="Filter tasks"
                                icon="filter"
                                clearable
                            ></nue-input>
                            <nue-button theme="small" icon="plus-circle">Status</nue-button>
                            <nue-button theme="small" icon="plus-circle">Priority</nue-button>
                        </nue-div>
                        <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                            <nue-button
                                theme="small,primary"
                                icon="plus-circle"
                                @click="showAddTodoPopup('todo')"
                                >Add</nue-button
                            >
                            <nue-button theme="small" icon="menu">View</nue-button>
                        </nue-div>
                    </nue-div>
                </nue-header>
                <!-- sub-view content -->
                <nue-main style="margin: 16px 0">
                    <router-view></router-view>
                </nue-main>
                <!-- sub-view footer -->
                <nue-footer style="padding: 4px; border: none; height: fit-content">
                    <nue-div align="center" justify="space-between" wrap="nowrap">
                        <nue-text size="12px" color="gray" flex>0 of 100 row(s) selected.</nue-text>
                        <nue-div
                            align="center"
                            justify="end"
                            width="fit-content"
                            wrap="nowrap"
                            gap="32px"
                        >
                            <nue-div align="center" width="fit-content" gap="8px">
                                <nue-text size="12px">Rows per page</nue-text>
                                <nue-select size="small">
                                    <li>10</li>
                                    <li>20</li>
                                    <li>30</li>
                                </nue-select>
                            </nue-div>
                            <nue-text size="12px">Page 1 of 10</nue-text>
                            <nue-div width="fit-content" gap="8px">
                                <nue-button theme="small" icon="arrow-left-more"></nue-button>
                                <nue-button theme="small" icon="arrow-left"></nue-button>
                                <nue-button theme="small" icon="arrow-right"></nue-button>
                                <nue-button theme="small" icon="arrow-right-more"></nue-button>
                            </nue-div>
                        </nue-div>
                    </nue-div>
                </nue-footer>
            </nue-container>
        </nue-div>
    </template>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/useProjectStore'
import { useTodoStore } from '@/stores/useTodoStore'
import { findOne } from '@/utils/utils'
import TodoDetailsDrawer from '@/components/project/todo-details-drawer.vue'
import ProjectNotFound from '@/components/project/project-not-found.vue'
import { NueMessage, NuePrompt, NueConfirm } from 'nue-ui'
import { storeToRefs } from 'pinia'
import type { Todo } from '@/stores/useTodoStore'

// options
defineOptions({ name: 'ProjectView' })

// props
const props = withDefaults(defineProps<{ projectId: string }>(), {})

// router
const router = useRouter()

// store
const projectStore = useProjectStore()
const todoStore = useTodoStore()

// refs
const filterValue = ref('')
const { selectedTodoId } = storeToRefs(todoStore)
const addTodoPopupVisible = ref(false)
const statusOfNewTodo = ref<Todo['status']>('todo')
const todoDetailsDrawerVisible = ref(false)

// computed
const currentProject = computed(() => {
    const p = findOne(projectStore.projects, (p) => p.id === props.projectId) || null
    // console.log('currentProject', p)
    return p
})

// methods
function showAddTodoPopup(todoStatus: Todo['status']) {
    statusOfNewTodo.value = todoStatus
    // addTodoPopupVisible.value = true
    NuePrompt({
        title: 'Create new todo',
        placeholder: 'Please input todo name here...',
        confirmButtonText: 'Create',
        cancelButtonText: 'Cancel',
        validator: (value: any) => value
    }).then((value) => {
        handleAddTodo(value as Todo['name'])
    })
}

function handleAddTodo(todoName: Todo['name']) {
    // console.log('handleAddTodo', todoName, statusOfNewTodo.value)
    todoStore.create(currentProject.value.id, todoName, statusOfNewTodo.value).then(
        () => {
            NueMessage({ message: 'Create todo successfully', type: 'success' })
            addTodoPopupVisible.value = false
        },
        (err) => {
            NueMessage({ message: err, type: 'error' })
            addTodoPopupVisible.value = false
        }
    )
}

function showTodoDetailsDrawer(todoId: Todo['id']) {
    selectedTodoId.value = todoId
    todoDetailsDrawerVisible.value = true
}

function handleDeleteProject() {
    NueConfirm({
        title: 'Delete project',
        content: 'Are you sure to delete this project?',
        confirmButtonText: 'Sure',
        cancelButtonText: 'Cancel'
    }).then(
        () => {
            projectStore.remove(currentProject.value.id).then(
                () => {
                    NueMessage({ message: 'Project deleted successfully', type: 'success' })
                },
                (err) => {
                    NueMessage({ message: err, type: 'error' })
                }
            )
        },
        () => NueMessage({ message: 'Operation canceled', type: 'info' })
    )
}

// provide
provide('currentProject', currentProject)
provide('showAddTodoPopup', showAddTodoPopup)
provide('showTodoDetailsDrawer', showTodoDetailsDrawer)

// onMounted
onMounted(() => {
    router.replace({ name: 'board' })
})
</script>
