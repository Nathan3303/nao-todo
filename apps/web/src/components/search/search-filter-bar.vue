<script lang="ts" setup>
import { computed } from 'vue'
import { InnerDropdownOption } from '@nao-todo/shared'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '@nao-todo/presentation/task'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { storeToRefs } from 'pinia'

/**
 * 搜索页结构化筛选栏（SEA-03 / DEF-1）
 * @description 四维内联多选（清单/标签/优先级/状态）：维内 OR、维间 AND、空=不限；
 *              触发器为 NueButton，已选数量放 #append 徽标（未选无徽标、激活底色高亮）；
 *              点击展开 NueDropdown 多选面板；状态由父（引擎）持有，本组件 props 驱动、
 *              仅展示与上抛事件（零业务逻辑）。
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

// @options 清单：收件箱哨兵（projectId=''）+ 用户清单
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

// @options 优先级 / 状态（复用任务侧常量）
const priorityOptions = computed(() => TaskPrioritySelectOptions.value)
const stateOptions = computed(() => TaskStateSelectOptions.value)

const isChecked = (list: string[], id: string) => list.includes(id)
</script>

<template>
    <div class="search-filter-bar">
        <div class="search-filter-bar__dims">
            <!-- 清单（收件箱哨兵 + 用户清单） -->
            <nue-dropdown
                placement="bottom-start"
                theme="menu"
                size="small"
                group="search-filter"
                :close-when-executed="false"
                @execute="(id: string) => emit('toggleProject', id)"
            >
                <template #trigger="{ trigger, visible }">
                    <nue-button :aria-expanded="visible" @click="trigger($event)" theme="small">
                        清单
                        <template v-if="selectedProjectIds.length > 0" #append>
                            <span :aria-label="`已选 ${selectedProjectIds.length} 项`">
                                {{ selectedProjectIds.length }}
                            </span>
                        </template>
                    </nue-button>
                </template>
                <nue-div theme="block">
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
                </nue-div>
            </nue-dropdown>

            <!-- 标签（色点为用户数据） -->
            <nue-dropdown
                placement="bottom-start"
                theme="menu"
                size="small"
                group="search-filter"
                :close-when-executed="false"
                @execute="(id: string) => emit('toggleTag', id)"
            >
                <template #trigger="{ trigger, visible }">
                    <nue-button :aria-expanded="visible" @click="trigger($event)" theme="small">
                        标签
                        <template v-if="selectedTagIds.length > 0" #append>
                            <span :aria-label="`已选 ${selectedTagIds.length} 项`">
                                {{ selectedTagIds.length }}
                            </span>
                        </template>
                    </nue-button>
                </template>
                <nue-div theme="block">
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
                </nue-div>
            </nue-dropdown>

            <!-- 优先级 -->
            <nue-dropdown
                placement="bottom-start"
                theme="menu"
                size="small"
                group="search-filter"
                :close-when-executed="false"
                @execute="(id: string) => emit('togglePriority', id)"
            >
                <template #trigger="{ trigger, visible }">
                    <nue-button :aria-expanded="visible" @click="trigger($event)" theme="small">
                        优先级
                        <template v-if="selectedPriorities.length > 0" #append>
                            <span :aria-label="`已选 ${selectedPriorities.length} 项`">
                                {{ selectedPriorities.length }}
                            </span>
                        </template>
                    </nue-button>
                </template>
                <nue-div theme="block">
                    <inner-dropdown-option
                        v-for="option in priorityOptions"
                        :key="option.value"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="isChecked(selectedPriorities, option.value)"
                    />
                </nue-div>
            </nue-dropdown>

            <!-- 状态 -->
            <nue-dropdown
                placement="bottom-start"
                theme="menu"
                size="small"
                group="search-filter"
                :close-when-executed="false"
                @execute="(id: string) => emit('toggleState', id)"
            >
                <template #trigger="{ trigger, visible }">
                    <nue-button :aria-expanded="visible" @click="trigger($event)" theme="small">
                        状态
                        <template v-if="selectedStates.length > 0" #append>
                            <span :aria-label="`已选 ${selectedStates.length} 项`">
                                {{ selectedStates.length }}
                            </span>
                        </template>
                    </nue-button>
                </template>
                <nue-div theme="block">
                    <inner-dropdown-option
                        v-for="option in stateOptions"
                        :key="option.value"
                        :icon="option.icon"
                        :title="option.label"
                        :execute-id="option.value"
                        :checked="isChecked(selectedStates, option.value)"
                    />
                </nue-div>
            </nue-dropdown>
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
/* 颜色全走 shadlike 令牌（标签色点为用户数据豁免） */
.search-filter-bar {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-sm);
    flex-wrap: wrap;
}

.search-filter-bar__dims {
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-xs);
    flex-wrap: wrap;
    min-width: 0;
}

/* —— NueButton 触发器 —— */
.filter-trigger {
    --nue-button-font-size: var(--nue-text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    transition:
        background-color var(--nue-animation-duration-short) var(--nue-animation-timing-function),
        color var(--nue-animation-duration-short) var(--nue-animation-timing-function);
}
.filter-trigger__icon {
    flex: none;
}
.filter-trigger__label {
    line-height: 1;
}

/* 已选状态：底色提亮 + 正文加粗（与未选 ghost 两态可辨；双主题自适应） */
.filter-trigger--active {
    background: color-mix(in srgb, var(--nue-primary-text-color) 10%, var(--nue-primary-color-0));
    font-weight: 600;
}

/* 计数徽标（#append）：橙色语义、灰阶外框令牌，明暗均可辨 */
.filter-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: 999px;
    font-size: var(--nue-text-2xs);
    line-height: 18px;
    font-weight: 700;
    color: var(--nue-warning-color-80);
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