<template>
    <nue-div class="project-kanban">
        <empty :empty="!todos.length" message="当前项目还没有待办事项" full-height>
            <nue-container
                class="project-kanban__column"
                v-for="(todos, category) in categoriedTodos"
            >
                <nue-header class="project-kanban__column__header">
                    <todo-state-info :state="category"></todo-state-info>
                    <nue-text size="12px" color="gray">{{ todos.length }}</nue-text>
                </nue-header>
                <nue-main class="project-kanban__column__main">
                    <todo-card v-for="todo in todos" :key="todo.id" :todo="todo"></todo-card>
                </nue-main>
            </nue-container>
        </empty>
    </nue-div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TodoCard, TodoStateInfo, Empty } from '@nao-todo/components'
import { useTodoStore, useUserStore, type Project, type Todo } from '@/stores'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'ProjectKanban' })
const props = defineProps<{ projectId: Project['id'] }>()

const userStore = useUserStore()
const todoStore = useTodoStore()

const { user } = storeToRefs(userStore)
await todoStore.init(user.value!.id, { projectId: props.projectId, isDeleted: false })
const { todos } = storeToRefs(todoStore)

const categoriedTodos = computed(() => {
    const result: { [key in Todo['state']]: Todo[] } = {
        todo: [],
        'in-progress': [],
        done: []
    }
    for (const todo of todos.value) {
        result[todo.state].push(todo)
    }
    return result
})
</script>

<style scoped>
.project-kanban {
    flex-wrap: nowrap;
    flex: 1 1 auto;
    overflow: hidden;
    overflow-x: auto;
    box-sizing: border-box;
    gap: 1px;

    .project-kanban__column {
        min-width: 320px;
        height: 100%;
        flex: 1 1 auto;
        box-shadow: 1px 0px var(--aside-border-color);
        padding: 0px 12px;
        gap: 12px;

        .project-kanban__column__header {
            height: 32px;
            align-items: center;
            padding: 0px;
            border: none;

            .nue-text--count {
                min-width: 24px;
                height: 24px;
                line-height: 24px;
                font-size: 14px;
                background-color: var(--primary-color);
                color: white;
                border-radius: var(--primary-radius);
                text-align: center;
            }
        }

        .project-kanban__column__main {
            flex-direction: column;
            gap: 12px;
        }
    }
}
</style>
