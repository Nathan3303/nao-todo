<template>
    <nue-div v-if="data" class="todo-node" vertical @click.stop="handleClick">
        <nue-div class="todo-node__content" gap="8px" width="100%">
            <nue-button
                :icon="data.status === 'done' ? 'icon-checked-fill' : 'icon-uncheck'"
                theme="icon-only"
                shape="no-shape"
                :loading="isChecking"
                :disabled="isChecking"
                @click.stop="emit('check', data.id)"
            />
            <nue-div flex vertical gap="4px" class="todo-node__info">
                <!-- {{ data.name }} -->
                <nue-text class="todo-node__name"> {{ data.name }} </nue-text>
                <nue-text class="todo-node__description"> {{ data.description }} </nue-text>
            </nue-div>
            <nue-avatar src="https://placehold.co/150x150/cacaca/fff?text=N" shape="round" />
        </nue-div>
        <nue-div class="todo-node__footer" justify="start" align="center" wrap>
            <nue-button theme="no-shape" icon="icon-calendar">Until tomorrow 19:30</nue-button>
            <nue-button v-if="data.progress.total" theme="no-shape" icon="icon-target">
                {{ data.progress.total - data.progress.finished }} / {{ data.progress.total }}
            </nue-button>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
// import { useRouter } from 'vue-router'
import type { Todo } from '@/stores/useTodoStore'

defineOptions({ name: 'TodoNode' })
const props = defineProps<{ data: Todo }>()
const emit = defineEmits(['removed', 'check'])

const showTodoDetailsDrawer: Function = inject('showTodoDetailsDrawer')!
// const router = useRouter()

const isChecking = ref(false)

function handleClick() {
    showTodoDetailsDrawer(props.data.id)
    // router.push({ name: 'project/board/todo', params: { todoId: props.data.id } })
}
</script>
