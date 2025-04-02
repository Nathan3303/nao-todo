<template>
    <nue-div class="todo-table__order-bar" gap="8px" style="margin-bottom: 12px" wrap="nowrap">
        <nue-select v-model="sortOptions.field" placeholder="排序字段" size="small">
            <nue-select-option label="创建时间" style="width: 96px" value="createTime" />
            <nue-select-option label="更新时间" value="updateTime" />
            <nue-select-option label="优先级" value="priority" />
            <nue-select-option label="状态" value="state" />
            <nue-select-option label="所属清单" value="project" />
            <nue-select-option label="结束日期" value="endAt" />
            <!-- <nue-select-option label="开始日期" value="startAt" /> -->
        </nue-select>
        <nue-select v-model="sortOptions.order" placeholder="排序方式" size="small">
            <nue-select-option label="升序" style="width: 72px" value="asc" />
            <nue-select-option label="降序" value="desc" />
        </nue-select>
        <nue-div flex />
        <nue-button
            v-if="sortOptions.field !== ''"
            flex="none"
            icon="clear"
            theme="small"
            @click="handleResetSortOptions"
        >
            重置排序
        </nue-button>
    </nue-div>
</template>

<script lang="ts" setup>
import { reactive, watch } from 'vue'
import type { GetTodosSortOptions } from '@nao-todo/types'

const props = defineProps<{ sortOptions?: GetTodosSortOptions }>()
const emit = defineEmits<{ (e: 'update', options: GetTodosSortOptions): void }>()

const defaultSortOptions: GetTodosSortOptions = {
    field: '',
    order: 'asc'
}

const sortOptions = reactive<GetTodosSortOptions>(
    props.sortOptions || {
        ...defaultSortOptions
    }
)

const handleResetSortOptions = () => {
    sortOptions.field = defaultSortOptions.field
    sortOptions.order = defaultSortOptions.order
}

watch(sortOptions, () => {
    emit('update', sortOptions)
})
</script>
