<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TaskDetailsAdapter } from '@nao-todo/presentation/task'
import { LoadingError, assetUrl } from '@nao-todo/shared'
import { isTaskOverdue } from '@/components/calendar/monthly/use-calendar-monthly'
import { dateKeyLabel, type SearchRow } from '@/components/search/search-tasks'
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
    rows,
    resultCount
} = useSearchEngine()
const { init, isLoading: viewLoading, error: viewError } = useSearchView()

// @context UI 级方法/取色（业务依赖已由引擎/视图本地组装）
const { showTaskDetails, getProjectName } = inject(INDEX_VIEW_CONTEXT_KEY)!
const tagsStore = useTagsStore()

const searchInputEl = ref<HTMLInputElement | null>(null)

// @computed 门禁：首拉（无缓存）+ 项目/标签初始化
const gateLoading = computed(() => viewLoading.value || firstLoading.value)
const gateError = computed(() => {
    if (ready.value) return false // 有缓存：错误降级为页内轻提示，保留旧结果不闪屏
    return viewError.value !== '' || error.value !== ''
})

// @method 输入/清空（输入绑定原生 input；去抖/结果重算在引擎内）
const onInput = (e: Event) => writeKeyword((e.target as HTMLInputElement).value)
const onClear = () => {
    clearKeyword()
    nextTick(() => searchInputEl.value?.focus())
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

// @method 行内展示辅助（纯展示口径，随 store 联动）
const tagOf = (id: string) => tagsStore.getTag(id)
const chipsOf = (tags: string[]) =>
    tags
        .map((id) => tagOf(id))
        .filter((tag): tag is NonNullable<typeof tag> => !!tag)
        .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))
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

// @lifecycle 视图初始化 + 输入自动聚焦（门禁通过后聚焦）
onMounted(() => {
    void init()
    nextTick(() => searchInputEl.value?.focus())
})
watch(
    () => gateLoading.value,
    (loading) => {
        if (!loading) nextTick(() => searchInputEl.value?.focus())
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
                        <nue-div class="search-box-row" align="center" gap="10px">
                            <input
                                ref="searchInputEl"
                                class="search-input"
                                type="text"
                                :value="keyword"
                                placeholder="搜索全部任务的名称 / 备注…"
                                @input="onInput"
                            />
                            <nue-button
                                v-if="keyword"
                                theme="icon,small"
                                icon="clear"
                                aria-label="清空关键词"
                                @click="onClear"
                            />
                        </nue-div>
                        <!-- 结果 N + 子任务补拉/失败/超限/后台刷新轻提示 -->
                        <nue-div class="search-toolbar__meta" align="center" gap="8px">
                            <nue-text
                                v-if="keyword && ready"
                                size="var(--nue-text-sm)"
                                class="srch-count"
                            >
                                找到 {{ resultCount }} 条
                            </nue-text>
                            <nue-text v-if="enumerating" size="var(--nue-text-sm)" class="srch-tip">
                                子任务补拉中…
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
                                <nue-button theme="small,ghost" @click="retryViewInit"
                                    >重试</nue-button
                                >
                            </nue-text>
                        </nue-div>
                    </nue-div>

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
                            class="search-row"
                            :class="{
                                'search-row--done': isDone(row.task),
                                'search-row--overdue': isRowOverdue(row.task)
                            }"
                            @click="openTaskDetails(row)"
                        >
                            <nue-div class="search-row__name" align="center" gap="8px">
                                <span
                                    v-if="priorityDotOf(row.task)"
                                    class="search-row__dot"
                                    :style="{ background: priorityDotOf(row.task) }"
                                />
                                <span class="search-row__text">
                                    <template v-for="(seg, idx) in row.nameSegments" :key="idx">
                                        <span v-if="seg.hit" class="srch-hl">{{ seg.text }}</span>
                                        <template v-else>{{ seg.text }}</template>
                                    </template>
                                </span>
                            </nue-div>
                            <nue-div
                                v-if="row.descriptionSegments"
                                class="search-row__desc"
                                align="center"
                            >
                                <span class="search-row__text search-row__text--desc">
                                    <template
                                        v-for="(seg, idx) in row.descriptionSegments"
                                        :key="idx"
                                    >
                                        <span v-if="seg.hit" class="srch-hl">{{ seg.text }}</span>
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
                                <span
                                    v-for="chip in chipsOf(row.task.tags)"
                                    :key="chip.id"
                                    class="search-row__tag"
                                >
                                    <span
                                        class="search-row__tag-dot"
                                        :style="{ background: chip.color }"
                                    />
                                    {{ chip.name }}
                                </span>
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
                </nue-content>
                <!-- 任务详情适配器（内嵌：路由 taskId 参数驱动，返回保持关键词/结果） -->
                <task-details-adapter />
            </nue-main>
        </loading-error>
    </nue-container>
</template>

<style scoped>
.search-page {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 1.25rem 1.5rem;
    min-width: 0;
    overflow: auto;
}

/* —— 工具栏 —— */
.search-toolbar {
    flex: none;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
}

.search-box-row {
    width: 100%;
    padding: 6px 12px;
    box-sizing: border-box;
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius);
    background: var(--nue-primary-color-0);
    transition: border-color 0.16s ease;
}
.search-box-row:focus-within {
    border-color: var(--nue-primary-color-500, var(--nue-border-color));
}

.search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--nue-primary-text-color);
    font-size: 0.9375rem;
    line-height: 1.5;
    padding: 2px 0;
}
.search-input::placeholder {
    color: color-mix(in srgb, var(--nue-primary-text-color) 45%, transparent);
}

.search-toolbar__meta {
    min-height: 20px;
    padding: 0 2px;
    flex-wrap: wrap;
}

.srch-count {
    color: var(--nue-primary-text-color);
}
.srch-tip {
    color: color-mix(in srgb, var(--nue-primary-text-color) 55%, transparent);
}
.srch-tip--warn {
    color: var(--nue-warning-color-60);
}

/* —— 空态 —— */
.search-state {
    flex: 1;
    width: 100%;
}

/* —— 结果列表 —— */
.search-results {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    gap: 2px;
}

.search-row {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    border-radius: var(--nue-primary-radius);
    cursor: pointer;
    transition: background-color 0.12s ease;
}
.search-row:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 6%, transparent);
}

.search-row__name {
    width: 100%;
    min-width: 0;
}
.search-row__text {
    min-width: 0;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--nue-primary-text-color);
    word-break: break-all;
}

.search-row__desc {
    width: 100%;
    margin-top: 1px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.search-row__text--desc {
    font-size: 0.8125rem;
    color: color-mix(in srgb, var(--nue-primary-text-color) 62%, transparent);
}

.search-row__dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

/* 高亮（纯文本分段，见 search-tasks.ts） */
.srch-hl {
    background: color-mix(in srgb, var(--nue-primary-color-500, #2563eb) 24%, transparent);
    border-radius: 3px;
    padding: 0 1px;
}

/* —— meta —— */
.search-row__meta {
    width: 100%;
    margin-top: 3px;
    gap: 6px;
    flex-wrap: wrap;
    min-height: 16px;
}
.search-row__project,
.search-row__date {
    color: color-mix(in srgb, var(--nue-primary-text-color) 58%, transparent);
}

.search-row__tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    height: 18px;
    border-radius: 9px;
    border: 1px solid var(--nue-border-color);
    font-size: 0.75rem;
    line-height: 18px;
    color: color-mix(in srgb, var(--nue-primary-text-color) 74%, transparent);
    background: color-mix(in srgb, var(--nue-primary-text-color) 4%, transparent);
}
.search-row__tag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
}

/* 完成态：灰显删划线，仍可点 */
.search-row--done .search-row__text {
    color: color-mix(in srgb, var(--nue-primary-text-color) 40%, transparent);
    text-decoration: line-through;
}
.search-row--done .search-row__desc {
    opacity: 0.6;
}
.search-row--done .search-row__meta {
    opacity: 0.55;
}

/* 逾期日期：红色（口径同日历 isTaskOverdue：endAt 早于今日且未完成） */
.search-row--overdue .search-row__date {
    color: var(--nue-error-color-60);
    font-weight: 500;
}
</style>