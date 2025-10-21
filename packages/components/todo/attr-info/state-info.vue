<script setup lang="ts">
import { computed } from 'vue'
import TodoBasicInfo from './basic-info.vue'
import type { Todo } from '@nao-todo/types'

defineOptions({ name: 'TodoStateInfo' })
const props = defineProps<{
    state: string
    colored?: boolean
    useClamped?: boolean
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

<style scoped>
.nue-div.nue-div--state-info {
    min-height: 1rem;

    .nue-text {
        line-height: 1;
    }
}
</style>

<template>
    <!-- <nue-div theme="state-info" align="center" gap=".25rem" wrap="nowrap" width="fit-content">
        <nue-icon
            :name="info[0]"
            color="var(--nue-primary-color-600)"
            size="var(--nue-text-df)"
            style="--nue-icon-weight: normal"
        />
        <nue-text
            :clamped="useClamped ? 1 : void 0"
            color="var(--nue-primary-color-600)"
            size="var(--nue-text-xs)"
        >
            {{ info[1] }}
        </nue-text>
    </nue-div> -->
    <todo-basic-info :icon="info[0]" :text="info[1]" :clamped="useClamped ? 1 : void 0" />
</template>

