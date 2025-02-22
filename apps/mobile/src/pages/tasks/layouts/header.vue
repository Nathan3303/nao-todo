<template>
    <view class="tasks__header">
        <view class="tasks__header__title-bar">
            <nuem-button icon="menu-open" theme="ico" @click="emits('showMenu')" />
            <text class="tasks__header__title-bar__title text--clamped">
                {{ viewInfo?.title }}
            </text>
            <view class="tasks__header__title-bar__actions">
                <!--                <nuem-button icon="delete" theme="ico" />-->
                <nuem-button icon="more" theme="ico" @click="handleToggleViewMenu" />
            </view>
        </view>
        <text v-if="viewInfo?.description" class="tasks__header__description">
            {{ viewInfo?.description }}
        </text>
        <view class="tasks__header__actions">
            <!-- 筛选按钮 -->
            <view class="tasks__header__actions__items">
                <nuem-button icon="filter" theme="sm">筛选</nuem-button>
                <nuem-button icon="select" theme="sm">排序</nuem-button>
            </view>
            <!-- 动作 -->
            <view class="tasks__header__actions__items">
                <nuem-button icon="plus-circle" theme="pri,sm" @click="emits('showAddTodoPanel')">
                    新增待办
                </nuem-button>
                <!--            <nuem-button icon="menu" theme="sm" />-->
                <nuem-button icon="refresh" theme="sm" />
            </view>
        </view>
    </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import NuemButton from '@/ui/button.vue'
import { useTasksViewStore } from '../stores/view'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksHeader' })
defineProps<{
    title?: string
    description?: string
}>()
const emits = defineEmits<{
    (e: 'showMenu'): void
    (e: 'showAddTodoPanel'): void
}>()

const viewMenu = ref()
const tasksViewStore = useTasksViewStore()

const { viewInfo } = storeToRefs(tasksViewStore)

const handleToggleViewMenu = () => {
    if (!viewMenu.value) return
    viewMenu.value.open()
}
</script>

<style scoped>
.tasks__header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    width: 100vw;
    padding: calc(var(--menu-button-top) + 1rem) 1rem 1rem;
    box-sizing: border-box;
    flex: none;
    z-index: 5;
    background-color: white;
}

.tasks__header__title-bar {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.5rem;
    margin-right: 6rem;
    height: 32px;
}

.tasks__header__title-bar__title {
    font-size: 1.14rem;
    flex: auto;
    display: block;
    max-height: calc(3 * var(--line-height));
    overflow: hidden;
    text-overflow: ellipsis;
}

.tasks__header__title-bar__actions {
    display: flex;
    align-items: center;
}

.tasks__header__description {
    font-size: 0.75rem;
    color: gray;
    line-height: 1.5;
}

.tasks__header__view-type-links {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    width: fit-content;
    gap: 2px;
    padding: 0.25rem;
    background-color: #f4f4f5;
    border-radius: 6px;
}

.tasks__header__view-type-links:deep(.nuem-button) {
    border: none;
    background-color: white;
}

.tasks__header__actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    flex: none;
    margin-top: 0.5rem;
}

.tasks__header__actions__items {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.5rem;
    flex: none;
}
</style>
