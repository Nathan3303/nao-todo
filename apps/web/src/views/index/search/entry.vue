<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TaskDetailsAdapter, TaskTagBar } from '@nao-todo/presentation/task'
import { LoadingError, assetUrl } from '@nao-todo/shared'
import { isTaskOverdue } from '@/components/calendar/monthly/use-calendar-monthly'
import { dateKeyLabel, type SearchRow } from '@/components/search/search-tasks'
import type { TaskTagViewObject } from '@nao-todo/domain-task'
import useSearchEngine from '@/components/search/use-search'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { useSearchView } from './search-view'

defineOptions({ name: 'SearchView' })

// —— 数据管线 + 视图初始化（DI 组装在组合式内；视图零业务逻辑） ——
const {
    keyword,
    writeKeyword,
    clearKeyword,
    ready,
    firstLoading,
    error,
    retry,
    capped,
    enumerating,
    enumFailures,
    enumRatePaused,
    rows,
    resultCount
} = useSearchEngine()
const { init, isLoading: viewLoading, error: viewError } = useSearchView()

// @context UI 级方法/取色（业务依赖已由引擎/视图本地组装）
const { showTaskDetails, getProjectName } = inject(INDEX_VIEW_CONTEXT_KEY)!
const tagsStore = useTagsStore()

const searchBoxRef = ref<HTMLElement | null>(null)

// @computed 门禁：首拉（无缓存）+ 项目/标签初始化
const gateLoading = computed(() => viewLoading.value || firstLoading.value)
const gateError = computed(() => {
    if (ready.value) return false // 有缓存：错误降级为页内轻提示，保留旧结果不闪屏
    return viewError.value !== '' || error.value !== ''
})

// @method 输入（NueInput update:model-value → 去抖/结果重算在引擎内；清空由 clearable 内置按钮触发同路径）
const onClear = () => {
    clearKeyword()
    focusSearchBox()
}

// @method 搜索框聚焦（NueInput 内部 input）
const focusSearchBox = () => {
    const inner = searchBoxRef.value?.querySelector<HTMLInputElement>('input')
    inner?.focus()
}

// @method 重试（整页门禁或后台刷新的统一出口）
const handleRetry = () => {
    if (viewError.value !== '') {
        viewError.value = ''
        void init()
    }
    if (error.value !== '') retry()
}

// @method 视图初始化失败重试（清单/标签加载）
const retryViewInit = () => {
    viewError.value = ''
    void init()
}

// @method 行点击 → 打开内嵌详情（当前路由 name 推送 taskId；返回后关键词/结果保持）
const openTaskDetails = (row: SearchRow) => showTaskDetails(row.task.id)

// @method 行键盘可达：Enter 开详情 / Esc 回搜索框（SEA-02 SR-3）
const handleRowKeydown = (row: SearchRow, event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        event.preventDefault()
        openTaskDetails(row)
    } else if (event.key === 'Escape') {
        event.preventDefault()
        focusSearchBox()
    }
}

// @computed 可用标签（TaskTagBar 所需 props；标签色为用户数据，展示层唯一颜色豁免）
const availableTagOptions = computed<TaskTagViewObject[]>(() =>
    [...tagsStore.tags.values()].map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
    }))
)
const isDone = (task: SearchRow['task']) => task.state === 'done'
const dateTextOf = (task: SearchRow['task']) => {
    const raw = task.endAt || task.startAt
    return dateKeyLabel(raw ? raw.slice(0, 10) : '', new Date().getFullYear())
}
const isRowOverdue = (task: SearchRow['task']) => isTaskOverdue(task)
// 优先级圆点色（high=error 红 / medium=warning 琥珀 / low 无；完成态不显示）
const priorityDotOf = (task: SearchRow['task']) => {
    if (isDone(task)) return ''
    if (task.priority === 'high') return 'var(--nue-error-color-60)'
    if (task.priority === 'medium') return 'var(--nue-warning-color-60)'
    return ''
}
// 优先级可读文案（title，非仅颜色）
const priorityTitleOf = (task: SearchRow['task']) => {
    if (task.priority === 'high') return '高优先级'
    if (task.priority === 'medium') return '中优先级'
    return ''
}

// @lifecycle 视图初始化 + 输入自动聚焦（门禁通过后聚焦）
onMounted(() => {
    void init()
    nextTick(focusSearchBox)
})
watch(
    () => gateLoading.value,
    (loading) => {
        if (!loading) nextTick(focusSearchBox)
    }
)
</script>

<template>
    <nue-container>
        <loading-error :loading="gateLoading" :error="gateError">
            <!-- 错误态（重试） -->
            <template #error>
                <nue-div vertical align="center" gap="12px">
                    <nue-text>{{ viewError || error }}</nue-text>
                    <nue-button theme="primary,small" @click="handleRetry">重试</nue-button>
                </nue-div>
            </template>
            <!-- 内容区域 -->
            <nue-main>
                <nue-content fill class="search-page">
                    <nue-div vertical class="search-toolbar" gap="4px">
                        <div ref="searchBoxRef" class="search-input-row">
                            <nue-input
                                :model-value="keyword"
                                icon="search"
                                clearable
                                width="100%"
                                placeholder="搜索全部任务的名称 / 备注…"
                                @update:model-value="writeKeyword"
                            />
                        </div>
                        <!-- 结果 N + 子任务补拉/失败/超限/后台刷新轻提示 -->
                        <nue-div class="search-toolbar__meta" align="center" gap="8px">
                            <nue-text
                                v-if="keyword && ready"
                                size="var(--nue-text-sm)"
                                class="srch-count"
                            >
                                找到 {{ resultCount }} 条
                            </nue-text>
                            <nue-text
                                v-if="enumerating || enumRatePaused"
                                size="var(--nue-text-sm)"
                                class="srch-tip"
                                :class="{ 'srch-tip--warn': enumRatePaused }"
                            >
                                {{
                                    enumRatePaused
                                        ? '子任务补拉受限流，稍后自动重试…'
                                        : '子任务补拉中…'
                                }}
                            </nue-text>
                            <nue-text
                                v-if="enumFailures > 0"
                                size="var(--nue-text-sm)"
                                class="srch-tip srch-tip--warn"
                            >
                                部分子任务拉取失败（{{ enumFailures }} 个父任务），再次输入将重试
                            </nue-text>
                            <nue-text
                                v-if="capped"
                                size="var(--nue-text-sm)"
                                class="srch-tip srch-tip--warn"
                            >
                                任务超过 5000 条，仅搜索前 5000 条
                            </nue-text>
                            <nue-text
                                v-if="error && ready"
                                size="var(--nue-text-sm)"
                                class="srch-tip srch-tip--warn"
                            >
                                刷新失败，仍在展示上次结果
                                <nue-button theme="small,ghost" @click="retry">重试</nue-button>
                            </nue-text>
                            <nue-text
                                v-if="viewError && ready"
                                size="var(--nue-text-sm)"
                                class="srch-tip srch-tip--warn"
                            >
                                清单/标签加载失败，部分名称可能缺失
                                <nue-button theme="small,ghost" @click="retryViewInit">
                                    重试
                                </nue-button>
                            </nue-text>
                        </nue-div>
                    </nue-div>

                    <!-- 结果独立滚动区（工具栏吸顶：输入/提示固定，长列表滚动不丢关键词） -->
                    <nue-div vertical class="search-scroll">
                        <!-- 空词态 -->
                        <nue-empty
                            v-if="!keyword && ready"
                            description="输入关键词，查找全部任务的名称与备注"
                            image-size="7rem"
                            class="search-state"
                        />
                        <!-- 无结果态（清词入口） -->
                        <nue-empty
                            v-else-if="keyword && ready && resultCount === 0"
                            :image-src="assetUrl('/images/error.webp')"
                            image-size="7rem"
                            class="search-state"
                        >
                            <nue-text size="var(--nue-text-sm)"
                                >未找到与「{{ keyword }}」匹配的任务</nue-text
                            >
                            <nue-button theme="small,ghost" @click="onClear">清空关键词</nue-button>
                        </nue-empty>

                        <!-- 结果列表（行点击开内嵌详情） -->
                        <nue-div v-else vertical class="search-results">
                            <nue-div
                                v-for="row in rows"
                                :key="row.task.id"
                                vertical
                                role="button"
                                tabindex="0"
                                :aria-label="row.task.name"
                                :title="row.task.name"
                                class="search-row"
                                :class="{
                                    'search-row--done': isDone(row.task),
                                    'search-row--overdue': isRowOverdue(row.task)
                                }"
                                @click="openTaskDetails(row)"
                                @keydown="handleRowKeydown(row, $event)"
                            >
                                <nue-div class="search-row__name" align="center" gap="8px">
                                    <span
                                        v-if="priorityDotOf(row.task)"
                                        :title="priorityTitleOf(row.task)"
                                        class="search-row__dot"
                                        :style="{ background: priorityDotOf(row.task) }"
                                    />
                                    <span class="search-row__name-text">
                                        <template v-for="(seg, idx) in row.nameSegments" :key="idx">
                                            <span v-if="seg.hit" class="srch-hl">{{
                                                seg.text
                                            }}</span>
                                            <template v-else>{{ seg.text }}</template>
                                        </template>
                                    </span>
                                </nue-div>
                                <nue-div
                                    v-if="row.descriptionSegments"
                                    class="search-row__desc"
                                    align="center"
                                >
                                    <span
                                        class="search-row__desc-text"
                                        :title="row.task.description"
                                    >
                                        <template
                                            v-for="(seg, idx) in row.descriptionSegments"
                                            :key="idx"
                                        >
                                            <span v-if="seg.hit" class="srch-hl">{{
                                                seg.text
                                            }}</span>
                                            <template v-else>{{ seg.text }}</template>
                                        </template>
                                    </span>
                                </nue-div>
                                <nue-div class="search-row__meta" align="center" gap="8px">
                                    <nue-text
                                        v-if="row.task.projectId"
                                        size="var(--nue-text-sm)"
                                        class="search-row__project"
                                    >
                                        {{ getProjectName(row.task.projectId) }}
                                    </nue-text>
                                    <task-tag-bar
                                        v-if="row.task.tags.length"
                                        :available-tags="availableTagOptions"
                                        :task-tag-ids="row.task.tags"
                                        readonly
                                        small
                                    />
                                    <nue-text
                                        v-if="dateTextOf(row.task)"
                                        size="var(--nue-text-sm)"
                                        class="search-row__date"
                                    >
                                        {{ dateTextOf(row.task) }}
                                    </nue-text>
                                </nue-div>
                            </nue-div>
                        </nue-div>
                    </nue-div>
                </nue-content>
                <!-- 任务详情适配器（内嵌：路由 taskId 参数驱动，返回保持关键词/结果） -->
                <task-details-adapter />
            </nue-main>
        </loading-error>
    </nue-container>
</template>

<style scoped>
/* SEA-02：样式全部引用 nue-ui-theme-shadlike 令牌（明暗自动适配）；无新增 hex/rgb。
   基线对齐任务表格行（table.css）：名称 df2/primary-900、描述 sm/primary-500、
   属性列 sm/primary-800、行 hover=primary 底、done=整行 opacity .8。 */

.search-page {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-xs);
    padding: var(--nue-padding-md) var(--nue-padding-lg);
    box-sizing: border-box;
    min-width: 0;
    height: 100%;
    overflow: hidden;
}

/* —— 工具栏（吸顶区：输入框与提示固定在结果滚动区之外） —— */
.search-toolbar {
    flex: none;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    z-index: 1;
}

.search-input-row {
    width: 100%;
}
.search-input-row :deep(input) {
    font-size: var(--nue-text-df2);
}

.search-toolbar__meta {
    min-height: 20px;
    padding: 0 2px;
    flex-wrap: wrap;
}

.srch-count {
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm);
}
.srch-tip {
    color: var(--nue-secondary-text-color);
}
.srch-tip--warn {
    color: var(--nue-warning-color-60);
}

/* —— 结果独立滚动区（空态/无结果/列表同区；输入/提示固定不丢失） —— */
.search-scroll {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    overflow-y: auto;
    overflow-x: hidden;
}

/* —— 空态 / 无结果态 —— */
.search-state {
    flex: 1;
    width: 100%;
    min-height: 160px;
}

/* —— 结果列表 —— */
.search-results {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    padding-bottom: var(--nue-padding-df);
}

.search-row {
    width: 100%;
    box-sizing: border-box;
    padding: var(--nue-padding-sm) var(--nue-padding-df);
    border-radius: var(--nue-primary-radius);
    cursor: pointer;
    outline: none;
    gap: var(--nue-gap-2xs);
    transition:
        background-color var(--nue-animation-duration-short) var(--nue-animation-timing-function),
        border-color var(--nue-animation-duration-short) var(--nue-animation-timing-function);
}
.search-row:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 7%, var(--nue-primary-color-0));
}
.search-row:active {
    background: color-mix(in srgb, var(--nue-primary-text-color) 12%, var(--nue-primary-color-0));
}
/* 键盘可达：可见焦点环（令牌描边；勿 outline:none 无替代） */
.search-row:focus-visible {
    outline: 2px solid var(--nue-primary-color-500);
    outline-offset: 2px;
}

.search-row__name {
    width: 100%;
    min-width: 0;
    gap: var(--nue-gap-2xs);
}

/* 名称：df2 / primary-900；≤2 行省略 + 原生 title 全文；CJK 正常换行 + 长 token 可断 */
.search-row__name-text {
    flex: 1;
    min-width: 0;
    font-size: var(--nue-text-df2);
    line-height: 1.5;
    color: var(--nue-primary-color-900);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
}

.search-row__desc {
    width: 100%;
    min-width: 0;
    margin-top: var(--nue-gap-2xs);
}
/* 描述：sm / primary-500；同两行 clamp（命中片段预览） */
.search-row__desc-text {
    display: -webkit-box;
    -webkit-line-clamp: 3; /* 对齐任务列表行口径（list-main：clamp 3 + title 全文） */
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    font-size: var(--nue-text-sm);
    line-height: 1.5;
    color: var(--nue-primary-color-500);
}

.search-row__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: calc((var(--nue-text-df2) * 1.5 - 8px) / 2);
}

/* 高亮（纯文本分段渲染，底色同源 ramp 令牌，明暗可辨；禁字面量颜色） */
.srch-hl {
    background: color-mix(in srgb, var(--nue-primary-color-500) 26%, var(--nue-primary-color-0));
    border-radius: var(--nue-radius-sm);
    padding: 0 1px;
}

/* —— meta（属性列口径：sm / primary-800） —— */
.search-row__meta {
    width: 100%;
    margin-top: var(--nue-gap-2xs);
    gap: var(--nue-gap-2xs);
    flex-wrap: wrap;
    min-height: 20px;
}
.search-row__project,
.search-row__date {
    font-size: var(--nue-text-sm);
    line-height: 1.5;
    color: var(--nue-primary-color-800);
}

/* 完成态：整行 opacity .8 + 名称删划线 + 无优先级点；meta 保持可读 */
.search-row--done {
    opacity: 0.8;
}
.search-row--done .search-row__name-text {
    text-decoration: line-through;
    text-decoration-color: var(--nue-primary-color-600);
}
.search-row--done .search-row__dot {
    display: none;
}

/* 逾期日期：红色（口径同日历 isTaskOverdue；跨页统一 error-30 属 P2 另立，此处保持现状） */
.search-row--overdue .search-row__date {
    color: var(--nue-error-color-60);
    font-weight: 500;
}
</style>