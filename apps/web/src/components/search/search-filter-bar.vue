<script lang="ts" setup>
import { computed } from 'vue'
import { InnerDropdownOption } from '@nao-todo/shared/components/inner-dropdown'
import { t } from '@nao-todo/shared/locales'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '@nao-todo/presentation/task'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { storeToRefs } from 'pinia'
import FilterTriggerLabel from './filter-trigger-label.vue'

/**
 * 搜索页结构化筛选栏（SEA-03 / DEF-1）
 * @description 四维内联多选（清单/标签/优先级/状态）：维内 OR、维间 AND、空=不限；
 *              触发器为 NueButton，已选名称按维度选项顺序展示（≤2 全显、≥3 折叠 +N）；
 *              点击展开 NueDropdown 多选面板；状态由父（引擎）持有，本组件 props 驱动、
 *              仅展示与上抛事件（零业务逻辑）。
 */

defineOptions({ name: 'SearchFilterBar' })

const props = defineProps<{
    selectedProjectIds: string[]
    selectedTagIds: string[]
    selectedPriorities: string[]
    selectedStates: string[]
    active: boolean
    /** P2：是否包含已归档 */
    includeArchived: boolean
    /** 任一条件非空（关键词或筛选），决定「保存为常用搜索」是否可用 */
    canSave: boolean
}>()

const emit = defineEmits<{
    (e: 'toggleProject', id: string): void
    (e: 'toggleTag', id: string): void
    (e: 'togglePriority', id: string): void
    (e: 'toggleState', id: string): void
    (e: 'toggleArchived', value: boolean): void
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

/** 触发器展示项（id/名称/可选色点） */
type FilterTriggerItem = { id: string; name: string; color?: string }

/** 已选项按「各维度选项顺序」解析（未知 id 丢弃；不改引擎、不新增状态） */
const byOptionOrder = (selectedIds: string[], options: FilterTriggerItem[]): FilterTriggerItem[] =>
    options.filter((option) => selectedIds.includes(option.id))

const projectSelected = computed<FilterTriggerItem[]>(() =>
    byOptionOrder(props.selectedProjectIds, projectOptions.value)
)
const tagSelected = computed<FilterTriggerItem[]>(() =>
    byOptionOrder(props.selectedTagIds, tagOptions.value)
)
const prioritySelected = computed<FilterTriggerItem[]>(() =>
    byOptionOrder(
        props.selectedPriorities,
        priorityOptions.value.map((option) => ({ id: option.value, name: option.label }))
    )
)
const stateSelected = computed<FilterTriggerItem[]>(() =>
    byOptionOrder(
        props.selectedStates,
        stateOptions.value.map((option) => ({ id: option.value, name: option.label }))
    )
)

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
                    <nue-button
                        :aria-expanded="visible"
                        class="filter-trigger"
                        theme="small"
                        @click="trigger($event)"
                    >
                        <filter-trigger-label
                            :label="t('search.filter.project')"
                            :items="projectSelected"
                        />
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
                    <nue-button
                        :aria-expanded="visible"
                        class="filter-trigger"
                        theme="small"
                        @click="trigger($event)"
                    >
                        <filter-trigger-label
                            :label="t('search.filter.tag')"
                            :items="tagSelected"
                        />
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
                    <nue-button
                        :aria-expanded="visible"
                        class="filter-trigger"
                        theme="small"
                        @click="trigger($event)"
                    >
                        <filter-trigger-label
                            :label="t('search.filter.priority')"
                            :items="prioritySelected"
                        />
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
                    <nue-button
                        :aria-expanded="visible"
                        class="filter-trigger"
                        theme="small"
                        @click="trigger($event)"
                    >
                        <filter-trigger-label
                            :label="t('search.filter.state')"
                            :items="stateSelected"
                        />
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

        <!-- P2：包含已归档（默认关；开 ⇒ 结果纳入归档任务）
             注：NueSwitch 忽略默认插槽 ⇒ 文字用右侧兄弟元素；role/aria-checked/tabindex
             与 Enter·Space、点文字切换均由本组件补齐（⛔ 不改 nue-ui 组件本身） -->
        <div class="search-filter-bar__archived">
            <nue-switch
                :model-value="includeArchived"
                size="small"
                role="switch"
                :aria-checked="includeArchived"
                tabindex="0"
                @update:model-value="(value: boolean) => emit('toggleArchived', value)"
                @keydown.enter.prevent="emit('toggleArchived', !includeArchived)"
                @keydown.space.prevent="emit('toggleArchived', !includeArchived)"
            />
            <span
                class="search-filter-bar__archived-label"
                @click="emit('toggleArchived', !includeArchived)"
            >
                {{ t('search.includeArchived') }}
            </span>
        </div>

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

/* —— NueButton 触发器（④：限制最大宽度，超宽由 nue-text clamp 省略） —— */
.filter-trigger {
    --nue-button-font-size: var(--nue-text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
    max-width: 220px;
    transition:
        background-color var(--nue-animation-duration-short) var(--nue-animation-timing-function),
        color var(--nue-animation-duration-short) var(--nue-animation-timing-function);
}
.filter-trigger :deep(.nue-button__text) {
    min-width: 0;
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

/* ② 包含已归档：可见文字标签（NueSwitch 忽略默认插槽）+ 键盘可达 */
.search-filter-bar__archived {
    display: inline-flex;
    align-items: center;
    gap: var(--nue-gap-2xs);
}
.search-filter-bar__archived-label {
    cursor: pointer;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm);
    user-select: none;
}
.search-filter-bar__archived [role='switch']:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 2px;
    border-radius: var(--nue-radius-sm);
}

/* 靠右（筛选栏为全宽 flex 容器；换行时仍保持末端对齐） */
.search-filter-bar__save {
    flex: none;
    margin-left: auto;
}
</style>