<template>
    <nue-div class="todo-table-header">
        <nue-text theme="col" flex>名称</nue-text>
        <nue-text v-if="columns.createdAt" theme="col" style="width: 132px"> 创建于 </nue-text>
        <nue-text v-if="columns.priority" theme="col" style="width: 72px"> 优先级 </nue-text>
        <nue-text v-if="columns.state" theme="col" style="width: 90px"> 状态 </nue-text>
        <nue-icon name="more" style="opacity: 0"></nue-icon>
    </nue-div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { TodoTableContext } from './types'

const { columns } = inject('todoTableContext') as TodoTableContext
</script>

<style scoped></style>
