<template>
    <nue-div vertical class="board-column">
        <nue-div class="board-column__header" align="center">
            <nue-text>
                {{ columnTitle }}
                <column-counter :value="data.length" />
            </nue-text>
            <nue-button icon="icon-plus" theme="no-shape" @click.stop="showAddTodoPopup(title)" />
            <nue-button icon="icon-more" theme="no-shape" />
        </nue-div>
        <nue-div class="board-column__content" v-if="data.length" vertical>
            <todo-node v-for="(t, i) in data" :key="i" :data="t" @check="handleCheck" />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useTodoStore } from '@/stores/useTodoStore'
import type { Todo } from '@/stores/useTodoStore'
import ColumnCounter from './column-counter.vue'
import TodoNode from './todo-node.vue'
import { NueMessage } from 'nue-ui'

defineOptions({ name: 'BoardColumn' })

const props = defineProps<{ data: Todo[]; title: string }>()

const todoStore = useTodoStore()

const showAddTodoPopup: Function = inject('showAddTodoPopup')!

const columnTitle = computed(() => {
    const title = props.title.trim()
    return title.charAt(0).toUpperCase() + title.slice(1)
})

function handleCheck(todoId: Todo['id']) {
    todoStore.check(todoId).then(
        () => NueMessage({ message: 'Todo updated successfully', type: 'success' }),
        (err) => NueMessage({ message: err, type: 'error' })
    )
}
</script>
