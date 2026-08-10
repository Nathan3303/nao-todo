<script setup lang="ts">
import { LoadingError, Pager, t } from '@nao-todo/shared'
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
                            style="height: 100%"
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
}

.pomodoro-records-page__table {
    background-color: var(--nue-bg-color);
    border-radius: var(--nue-radius-md);
    /* 作为 flex 容器，让 table-main 以 flex:1 撑满 */
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;

    :deep(.nue-scroll-bar) {
        flex: 1;
    }
}

.pomodoro-records-page__pagination {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--nue-padding-sm);
}
</style>