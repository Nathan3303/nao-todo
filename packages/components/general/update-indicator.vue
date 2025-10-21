<script setup lang="ts">
// import { computed } from 'vue'

defineOptions({ name: 'UpdateIndicator' })
// const props =
defineProps<{
    updating: boolean
    count: number
}>()

// const tooltipContent = computed(() => {
//     return props.count > 0 ? `正在处理 ${props.count} 更新任务` : '暂无更新任务'
// })
</script>

<template>
    <!-- <nue-tooltip placement="right-center" size="small" :content="tooltipContent"> -->
    <!-- <nue-badge dot :hidden="!count"> -->
    <nue-icon name="update" :spin="updating" />
    <!-- </nue-badge> -->
    <!-- </nue-tooltip> -->
</template>

<style scoped>
.nue-badge {
    display: flex;
}

.nue-icon {
    --nue-icon-size: var(--nue-text-md);
    --nue-icon-color: var(--nue-primary-color-700);
}
</style>
