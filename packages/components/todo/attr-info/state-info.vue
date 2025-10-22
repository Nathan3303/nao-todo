<script setup lang="ts">
import { computed } from 'vue'
import TodoBasicInfo from './basic-info.vue'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoStateInfo' })
const props = defineProps<{
    state: string
    colored?: boolean
}>()

const stateInfos = {
    todo: ['circle', '待办'],
    'in-progress': ['in-progress', '正在进行'],
    doing: ['in-progress', '正在进行'],
    done: ['success-fill', '已完成']
}

const info = computed(() => {
    return stateInfos[props.state as Todo['state']]
})
</script>

<template>
    <todo-basic-info :icon="info[0]" :text="info[1]" :clamped="1" />
</template>

<style scoped>
.nue-div--basic-info {
    min-height: 1rem;
    flex: 1;
}
</style>

