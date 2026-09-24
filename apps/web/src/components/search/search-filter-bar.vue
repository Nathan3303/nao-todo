<script lang="ts" setup>
import { computed } from 'vue'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import { t } from '@nao-todo/shared/locales'
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
    /** S7b：是否纳入已删除/已放弃 */
    includeExcluded: boolean
    /** 任一条件非空（关键词或筛选），决定「保存为常用搜索」是否可用 */
    canSave: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleProject', id: string): void
    (e: 'toggleTag', id: string): void
    (e: 'togglePriority', id: string): void
    (e: 'toggleState', id: string): void
    (e: 'toggleExcluded', value: boolean): void
    (e: 'clear'): void
    (e: 'save'): void
}>()

// @options 清单：收件箱哨兵（projectId=''）+ 用户清单
const { avaliableProjects } = storeToRefs(useProjectsStore())
const projectOptions = computed<{ id: string; name: string }[]>(() => [
    { id: '', name: t('component.taskSelector.inbox') },
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
                        {{ t('search.filter.project') }}
                        <template v-if="selectedProjectIds.length > 0" #append>
                            <span
                                :aria-label="
                                    t('search.filter.selectedCount', {
                                        count: selectedProjectIds.length
                                    })
                                "
                            >
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
                        {{ t('search.filter.tag') }}
                        <template v-if="selectedTagIds.length > 0" #append>
                            <span
                                :aria-label="
                                    t('search.filter.selectedCount', {
                                        count: selectedTagIds.length
                                    })
                                "
                            >
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
                        <span class="filter-option-name">{{ t('search.filter.noTags') }}</span>
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
                        {{ t('search.filter.priority') }}
                        <template v-if="selectedPriorities.length > 0" #append>
                            <span
                                :aria-label="
                                    t('search.filter.selectedCount', {
                                        count: selectedPriorities.length
                                    })
                                "
                            >
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
                        {{ t('search.filter.state') }}
                        <template v-if="selectedStates.length > 0" #append>
                            <span
                                :aria-label="
                                    t('search.filter.selectedCount', {
                                        count: selectedStates.length
                                    })
                                "
                            >
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

        <!-- S7b：纳入已删除/已放弃（默认关；archived 恒排除） -->
        <nue-switch
            :model-value="includeExcluded"
            size="small"
            class="search-filter-bar__excluded"
            @update:model-value="(value: boolean) => emit('toggleExcluded', value)"
        >
            {{ t('search.includeExcluded') }}
        </nue-switch>

        <!-- 一键清空（任一维度激活时出现） -->
        <nue-button
            v-if="active"
            theme="small,ghost"
            icon="clear"
            class="search-filter-bar__clear"
            @click="emit('clear')"
        >
            {{ t('search.filter.clear') }}
        </nue-button>

        <!-- 保存为常用搜索（任一条件非空时可用；靠右） -->
        <nue-button
            :disabled="!canSave"
            theme="small"
            icon="subscribe"
            class="search-filter-bar__save"
            @click="emit('save')"
        >
            {{ t('search.saved.saveButton') }}
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

/* 靠右（筛选栏为全宽 flex 容器；换行时仍保持末端对齐） */
.search-filter-bar__save {
    flex: none;
    margin-left: auto;
}
</style>