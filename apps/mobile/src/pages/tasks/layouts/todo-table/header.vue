<template>
    <view class="todo-table__header">
        <!-- 筛选按钮 -->
        <view class="todo-table__header__actions">
            <nuem-button icon="filter" theme="sm">筛选</nuem-button>
            <nuem-button icon="select" theme="sm">排序</nuem-button>
        </view>
        <!-- 动作 -->
        <view class="todo-table__header__actions">
            <nuem-button icon="plus-circle" theme="pri,sm">新增</nuem-button>
<!--            <nuem-button icon="menu" theme="sm" />-->
            <nuem-button icon="refresh" theme="sm" />
        </view>
    </view>
</template>

<script lang="ts" setup>
import NuemButton from '@/ui/button.vue'

defineOptions({ name: 'TodoTableHeader' })
</script>

<style scoped>
.todo-table__header {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    flex: none;
}

.todo-table__header__actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.5rem;
    flex: none;
}
</style>
