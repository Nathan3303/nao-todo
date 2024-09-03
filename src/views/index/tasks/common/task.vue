<template>
    <suspense>
        <teleport to="#TasksViewRightAside">
            <nue-div class="todo-details-wrapper">
                <content-todo-details-v2 :todo-id="taskId"></content-todo-details-v2>
            </nue-div>
        </teleport>
    </suspense>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ContentTodoDetailsV2 } from '@/layers/index'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'TasksAllTableTaskView' })
defineProps<{ taskId: string; projectId?: string; tagId?: string }>()

const route = useRoute()
const router = useRouter()

// const handleCloseTodoDetails = () => {
//     todo.value = void 0
//     const prevRoute = route.matched[route.matched.length - 2]
//     if (prevRoute) {
//         setTimeout(() => router.push(prevRoute), 320)
//     }
// }
</script>

<style scoped>
.todo-details-wrapper {
    height: 100%;
    flex-wrap: nowrap;
    transition: all 0.32s ease-in-out;
    background-color: white;
    overflow: hidden;
    z-index: 0;
    padding: 0px;
}

@media screen and (max-width: 1200px) {
    .todo-details-wrapper {
        width: 440px;
        transform: translateX(0);
        position: absolute;
        right: 0;
        box-shadow: -2px 0px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        padding: 0px;
    }

    .todo-details-wrapper[data-empty='true'] {
        transform: translateX(100%);
        overflow: hidden;
        box-shadow: none;
    }
}
</style>
