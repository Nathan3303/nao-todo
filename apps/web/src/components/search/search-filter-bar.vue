<script lang="ts" setup>
import { computed } from 'vue'
import { InnerDropdown, InnerDropdownOption } from '@nao-todo/shared'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '@nao-todo/presentation/task'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { storeToRefs } from 'pinia'

/**
 * 搜索页结构化筛选栏（SEA-03）
 * @description 四维内联多选（清单/标签/优先级/状态）：维内 OR、维间 AND、空=不限；
 *              计数徽标 + 激活高亮 + 单项再点取消 + 一键清空。状态由父（引擎）持有，
 *              本组件仅展示与上抛事件（props 驱动、零业务逻辑）。
 */

defineOptions({ name: 'SearchFilterBar' })

defineProps<{
    selectedProjectIds: string[]
    selectedTagIds: string[]
    selectedPriorities: string[]
    selectedStates: string[]
    active: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleProject', id: string): void
    (e: 'toggleTag', id: string): void
    (e: 'togglePriority', id: string): void
    (e: 'toggleState', id: string): void
    (e: 'clear'): void
}>()

// @options 清单：收件箱哨兵（projectId=''）+ 用户清单（与任务列表 getProjectName 兜底同文案）
const { avaliableProjects } = storeToRefs(useProjectsStore())
const projectOptions = computed<{ id: string; name: string }[]>(() => [
    { id: '', name: '收集箱' },
    ...avaliableProjects.value.map((project) => ({ id: project.id, name: project.name }))
])

// @options 标签（全量，带用户数据色点——颜色豁免）
const tagsStore = useTagsStore()
const tagOptions = computed(() =>
    [...tagsStore.tags.values()].map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
    }))
)

// @options 优先级 / 状态（复用任务侧常量，含图标与本地化文案）
const priorityOptions = computed(() => TaskPrioritySelectOptions.value)
const stateOptions = computed(() => TaskStateSelectOptions.value)

const isChecked = (list: string[], id: string) => list.includes(id)
</script>

<template>
    <div class="search-filter-bar">
        <div class="search-filter-bar__dims">
            <!-- 清单（含收件箱哨兵） -->
            <div
                class="filter-dim"
                :class="{ 'filter-dim--active': selectedProjectIds.length > 0 }"
            >
                <inner-dropdown
                    title="清单"
                    icon="filter"
                    group="search-filter"
                    :suffix="selectedProjectIds.length"
                    :close-when-executed="false"
                    @execute="(id) => emit('toggleProject', id)"
                >
                    <nue-dropdown-item
                        v-for="option in projectOptions"
                        :key="option.id"
                        :execute-id="option.id"
                        size="small"
                    >
                        <span class="filter-option-name">{{ option.name }}</span>
                        <template #append>
                            <nue-icon
                                v-if="isChecked(selectedProjectIds, option.id)"
                                name="check"
                            />
                        </template>
                    </nue-dropdown-item>
                </inner-dropdown>
            </div>

            <!-- 标签（色点为用户数据） -->
            <div class="filter-dim" :class="{ 'filter-dim--active': selectedTagIds.length > 0 }">
                <inner-dropdown
                    title="标签"
                    icon="filter"
                    group="search-filter"
                    :suffix="selectedTagIds.length"
                    :close-when-executed="false"
                    @execute="(id) => emit('toggleTag', id)"
                >
                    <nue-dropdown-item
                        v-for="tag in tagOptions"
                        :key="tag.id"
                        :execute-id="tag.id"
                        size="small"
                    >
                        <span
                            class="filter-tag-dot"
                            :style="{ background: tag.color }"
                            aria-hidden="true"
                        />
                        <span class="filter-option-name">{{ tag.name }}</span>
                        <template #append>
                            <nue-icon v-if="isChecked(selectedTagIds, tag.id)" name="check" />
                        </template>
                    </nue-dropdown-item>
                    <nue-dropdown-item
                        v-if="tagOptions.length === 0"
                        :execute-id="'__none__'"
                        size="small"
                        disabled
                    >
                        <span class="filter-option-name">暂无标签</span>
                    </nue-dropdown-item>
                </inner-dropdown>
            </div>

            <!-- 优先级 -->
            <div
                class="filter-dim"
                :class="{ 'filter-dim--active': selectedPriorities.length > 0 }"
            >
                <inner-dropdown
                    title="优先级"
                    icon="filter"
                    group="search-filter"
                    :suffix="selectedPriorities.length"
                    :close-when-executed="false"
                    @execute="(id) => emit('togglePriority', id)"
                >
                    <inner-dropdown-option
                        v-for="option in priorityOptions"
                        :key="option.value"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="isChecked(selectedPriorities, option.value)"
                    />
                </inner-dropdown>
            </div>

            <!-- 状态 -->
            <div class="filter-dim" :class="{ 'filter-dim--active': selectedStates.length > 0 }">
                <inner-dropdown
                    title="状态"
                    icon="filter"
                    group="search-filter"
                    :suffix="selectedStates.length"
                    :close-when-executed="false"
                    @execute="(id) => emit('toggleState', id)"
                >
                    <inner-dropdown-option
                        v-for="option in stateOptions"
                        :key="option.value"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="isChecked(selectedStates, option.value)"
                    />
                </inner-dropdown>
            </div>
        </div>

        <!-- 一键清空（任一维度激活时出现） -->
        <nue-button
            v-if="active"
            theme="small,ghost"
            icon="clear"
            class="search-filter-bar__clear"
            @click="emit('clear')"
        >
            清空筛选
        </nue-button>
    </div>
</template>

<style scoped>
/* 全部颜色走 shadlike 令牌（标签色点为用户数据豁免）；布局 flex wrap 窄行换行 */
.search-filter-bar {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-sm);
    flex-wrap: wrap;
}

.search-filter-bar__dims {
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    flex-wrap: wrap;
    min-width: 0;
}

.filter-dim {
    min-width: 0;
}

/* 激活态高亮：计数徽标已是橙色；这里再加深触发器底/文字以双主题可辨 */
.filter-dim--active :deep(.nue-dropdown-item) {
    background: color-mix(in srgb, var(--nue-primary-text-color) 10%, var(--nue-primary-color-0));
    font-weight: 600;
}

.filter-option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
    vertical-align: middle;
}

.filter-tag-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: var(--nue-gap-2xs);
    vertical-align: middle;
    flex: none;
}

.search-filter-bar__clear {
    flex: none;
}
</style>