<template>
    <suspense>
        <teleport to="#TasksViewRightAside">
            <nue-div class="todo-details-wrapper">
                <todo-details-v2 :todo-id="taskId" />
            </nue-div>
        </teleport>
    </suspense>
</template>

<script setup lang="ts">
import { TodoDetailsV2 } from '@/layers'

defineOptions({ name: 'TasksAllTableTaskView' })
defineProps<{ taskId: string; projectId?: string; tagId?: string }>()
</script>
