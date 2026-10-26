<script setup lang="ts">
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { Pager } from '@nao-todo/shared/components/pager'
import { t } from '@nao-todo/shared/locales'
import StatsCards from './stats-cards.vue'
import FilterPanel from './filter-panel.vue'
import TableMain from './table-main.vue'
import DetailPanel from './detail-panel.vue'
import { provideRecordsTableContext } from './use-records-table'
import { PomodoroHeader } from '../header'

defineOptions({ name: 'PomodoroRecordsPage' })

const {
    resetFilters,
    loadFirstPage,
    stats,
    filters,
    pomodoros,
    applyFilters,
    loading,
    error,
    records,
    showDetail,
    pagination,
    goToPage,
    setPageSize,
    selectedRecord,
    detailVisible
} = provideRecordsTableContext()

const handleReset = () => {
    resetFilters()
    loadFirstPage()
}
</script>

<template>
    <nue-container id="PomodoroRecordsContainer">
        <pomodoro-header />
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-div class="pomodoro-records-page">
                    <!-- 统计卡片区域 -->
                    <stats-cards
                        :total-duration="stats.totalDuration.value"
                        :total-records="stats.totalRecords.value"
                        :session-count="stats.sessionCount.value"
                        :pomodoro-percentage="stats.pomodoroPercentage.value"
                    />

                    <!-- 筛选区域 -->
                    <filter-panel
                        :filters="filters"
                        :pomodoros="pomodoros"
                        @update:filters="applyFilters"
                        @apply="loadFirstPage"
                        @reset="handleReset"
                    />

                    <!-- 表格主体 -->
                    <div class="pomodoro-records-page__table">
                        <loading-error
                            :loading="loading"
                            :error="!!error"
                            :empty="!loading && !error && records.length === 0"
                            empty-message="暂无专注记录"
                        >
                            <template #error>
                                <nue-div vertical align="center">
                                    <nue-text size="var(--nue-text-sm)">{{ error }}</nue-text>
                                    <nue-button theme="primary,small" @click="loadFirstPage">
                                        {{ t('common.retry') }}
                                    </nue-button>
                                </nue-div>
                            </template>
                            <table-main
                                :records="records"
                                :pomodoros="pomodoros"
                                @show-detail="showDetail"
                            />
                        </loading-error>
                    </div>

                    <!-- 分页器 -->
                    <div v-if="records.length > 0" class="pomodoro-records-page__pagination">
                        <pager
                            :page="pagination.page"
                            :limit="pagination.limit"
                            :total="pagination.total"
                            :total-pages="pagination.maxPage"
                            :disabled="loading"
                            @page-change="goToPage"
                            @per-page-change="setPageSize"
                        />
                    </div>
                </nue-div>
            </nue-content>
        </nue-main>

        <!-- 详情抽屉 -->
        <detail-panel
            v-model:visible="detailVisible"
            :record="selectedRecord"
            :pomodoros="pomodoros"
        />
    </nue-container>
</template>

<style scoped>
#PomodoroRecordsContainer {
    > .nue-main {
        min-height: 0;

        > .nue-content {
            display: flex;
            flex-direction: column;
            padding: var(--nue-padding-md);
            box-sizing: border-box;
        }
    }
}

.pomodoro-records-page {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-lg);
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    /* 以 flex 撑满 content，而非依赖 height:100% 百分比链 */
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.pomodoro-records-page__table {
    background-color: var(--nue-bg-color);
    border-radius: var(--nue-radius-md);
    /* 作为 flex 容器，让 table-main 以 flex:1 撑满 */
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;

    :deep(.nue-scroll-bar) {
        flex: 1;
    }
}

.pomodoro-records-page__pagination {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--nue-padding-sm);
}

@media (max-width: 720px) {
    /* 窄屏：解除「内容区固定高 + 记录区 height:100%/overflow:hidden」锁死，
       由页容器自身成为纵向滚动主体（桌面分支不受影响） */
    .pomodoro-records-page {
        gap: var(--nue-gap-md);
        overflow: visible;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }

    /* 记录区不再定高裁切，让卡片列表按内容高度撑开 */
    .pomodoro-records-page__table {
        flex: none;
        height: auto;
        overflow: visible;
    }

    .pomodoro-records-page__pagination {
        flex-wrap: wrap;
        justify-content: center;
    }

    /* 仅窄屏、为可点区达标（R10，命中区口径 ≥40px）：small 视觉不变（Pager 自身已是 small = 28px 高），
       用不可见伪元素向外扩 6px/侧 ⇒ 命中区 = 28+12 = 40px；
       必须同时开 overflow:visible —— .nue-button 基础样式 overflow:hidden 会把出盒的 ::after 整个裁掉（扩展失效） */
    .pomodoro-records-page__pagination :deep(.nue-button) {
        position: relative;
        overflow: visible;

        &::after {
            content: '';
            position: absolute;
            inset: -6px;
        }
    }

    /* 仅窄屏、为箭头图标在按钮内水平居中（R11）：改主题自身的 alignment 机制
       （与 .nue-button--icon 变体同法：--nue-button-alignment:center；垂直居中由 align-items:center 已保证），
       桌面分页保持原样 */
    .pomodoro-records-page__pagination :deep(.nue-button) {
        --nue-button-alignment: center;
    }
}
</style>