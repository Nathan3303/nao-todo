<script setup lang="ts">
import { Loading as LoadingComp, Pager } from '@nao-todo/shared'
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
            <nue-content fill style="overflow-y: auto">
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
                        <loading-comp v-if="loading" height="auto" />
                        <nue-empty
                            v-else-if="!loading && records.length === 0"
                            image-size="4rem"
                            description="暂无专注记录"
                        />
                        <table-main
                            v-else
                            :records="records"
                            :pomodoros="pomodoros"
                            @show-detail="showDetail"
                        />
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
        > .nue-content {
            padding: var(--nue-padding-md);
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
}

.pomodoro-records-page__table {
    background-color: var(--nue-bg-color);
    border-radius: var(--nue-radius-md);
    padding: var(--nue-padding-md);
    min-height: 200px;
}

.pomodoro-records-page__pagination {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--nue-padding-sm);
}
</style>

