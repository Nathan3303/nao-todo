<template>
    <nao-smart-list
        collapse-item-name="filters"
        name="过滤器"
        manage-btn-tooltip="管理所有过滤器"
        create-btn-tooltip="创建新的过滤器"
        empty-text="根据清单、时间、优先级、标签等属性过滤出符合条件的特定任务"
    />
</template>

<script setup lang="ts">
import { NaoSmartList } from '@/components/ui'
</script>
