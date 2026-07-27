<script setup lang="ts">
import { Pager } from '@nao-todo/shared'
import dayjs from 'dayjs'
import { PomodoroHeader } from '../header'
import { PomodoroRecordListItem } from '@nao-todo/presentation/pomodoro'
import { usePomodoroCollection } from './use-pomodoro-collection'

defineOptions({ name: 'PomodoroCollectionPage' })

const {
    loading,
    selectedId,
    pomodoros,
    selectedPomodoro,
    handleSelect,
    handleEdit,
    records,
    recordLoading,
    recordPage,
    recordLimit,
    recordTotal,
    recordTotalPages,
    handleRecordPageChange,
    handleRecordPerPageChange
} = usePomodoroCollection()

// 时长格式化（秒 → x 时 x 分 x 秒）
const durationToString = (duration: number) => {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration - hours * 3600) / 60)
    const seconds = Math.floor(duration - hours * 3600 - minutes * 60)
    const hoursStr = hours ? `${hours} 时 ` : ''
    const minutesStr = minutes ? `${minutes} 分 ` : ''
    const secondsStr = seconds ? `${seconds} 秒 ` : ''
    return hoursStr + minutesStr + secondsStr || '0 秒'
}

// 类型文本
const typeToString = (type: number) => (type === 1 ? '番茄专注' : '正计时')
</script>

<template>
    <!-- 常用专注页面布局 -->
    <nue-container id="PomodoroCollection">
        <!-- 页面标题 -->
        <pomodoro-header />
        <nue-main>
            <nue-content>
                <!-- 列表区域 -->
                <nue-div theme="collection-list" style="grid-area: list">
                    <nue-div theme="header">
                        <nue-div theme="title">
                            <nue-icon name="list" />
                            <nue-text theme="title">常用专注</nue-text>
                        </nue-div>
                        <nue-text theme="count">共 {{ pomodoros.length }} 个</nue-text>
                    </nue-div>
                    <nue-div theme="main">
                        <nue-div v-if="!loading && pomodoros.length === 0" theme="empty">
                            <nue-text>暂无常用专注</nue-text>
                        </nue-div>
                        <nue-div v-else theme="rows">
                            <nue-div
                                v-for="item in pomodoros"
                                :key="item.id"
                                theme="card,collection-row"
                                :data-selected="item.id === selectedId"
                                @click="handleSelect(item.id)"
                            >
                                <nue-text theme="name" :clamped="1">{{ item.name }}</nue-text>
                                <nue-text theme="meta">
                                    {{ typeToString(item.type) }}，{{
                                        durationToString(item.duration)
                                    }}
                                </nue-text>
                            </nue-div>
                        </nue-div>
                    </nue-div>
                </nue-div>
                <!-- 详细区域 -->
                <nue-div theme="collection-detail" style="grid-area: detail">
                    <nue-div v-if="selectedPomodoro" theme="detail-card">
                        <nue-div theme="detail-header">
                            <nue-text theme="detail-name">{{ selectedPomodoro.name }}</nue-text>
                            <nue-text theme="detail-type">
                                {{ typeToString(selectedPomodoro.type) }}
                            </nue-text>
                            <nue-button
                                theme="icon,ghost,small"
                                icon="edit"
                                title="编辑"
                                @click="handleEdit"
                            />
                        </nue-div>
                        <nue-text v-if="selectedPomodoro.description" theme="detail-description">
                            {{ selectedPomodoro.description }}
                        </nue-text>
                        <nue-divider />
                        <nue-div theme="detail-field">
                            <nue-text theme="label">单次专注时长</nue-text>
                            <nue-text theme="value">
                                {{ durationToString(selectedPomodoro.duration) }}
                            </nue-text>
                        </nue-div>
                        <nue-div theme="detail-field">
                            <nue-text theme="label">累计专注时长</nue-text>
                            <nue-text theme="value">
                                {{ durationToString(selectedPomodoro.totalDuration) }}
                            </nue-text>
                        </nue-div>
                        <nue-div theme="detail-field">
                            <nue-text theme="label">归档状态</nue-text>
                            <nue-text theme="value">
                                {{ selectedPomodoro.isArchived ? '已归档' : '未归档' }}
                            </nue-text>
                        </nue-div>
                        <nue-div theme="detail-field">
                            <nue-text theme="label">创建时间</nue-text>
                            <nue-text theme="value">
                                {{ dayjs(selectedPomodoro.createdAt).format('YYYY-MM-DD HH:mm') }}
                            </nue-text>
                        </nue-div>
                        <!-- 专注记录 -->
                        <nue-divider />
                        <nue-div theme="records">
                            <nue-div theme="records-header">
                                <nue-text theme="records-title">专注记录</nue-text>
                                <nue-text theme="records-count">共 {{ recordTotal }} 条</nue-text>
                            </nue-div>
                            <nue-div theme="records-main">
                                <nue-div v-if="recordLoading" theme="records-tip">
                                    <nue-text>加载中...</nue-text>
                                </nue-div>
                                <nue-div v-else-if="records.length === 0" theme="records-tip">
                                    <nue-text>暂无专注记录</nue-text>
                                </nue-div>
                                <nue-div v-else theme="records-rows">
                                    <pomodoro-record-list-item
                                        v-for="record in records"
                                        :key="record.id"
                                        :record="record"
                                    />
                                </nue-div>
                            </nue-div>
                            <nue-div theme="records-footer">
                                <pager
                                    :page="recordPage"
                                    :limit="recordLimit"
                                    :total="recordTotal"
                                    :total-pages="recordTotalPages"
                                    :disabled="recordLoading"
                                    simple
                                    @page-change="handleRecordPageChange"
                                    @per-page-change="handleRecordPerPageChange"
                                />
                            </nue-div>
                        </nue-div>
                    </nue-div>
                    <nue-div v-else theme="empty">
                        <nue-text>请选择一个常用专注查看详情</nue-text>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#PomodoroCollection {
    > .nue-main .nue-content {
        display: grid;
        grid-template-columns: 3fr 4fr;
        grid-template-rows: 1fr;
        grid-template-areas: 'list detail';
        width: 100%;
        height: 100%;
        flex: none;
        gap: var(--nue-gap-df);
        overflow: visible;
        padding: var(--nue-padding-df);
        box-sizing: border-box;

        @media (max-width: 720px) {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
            grid-template-areas: 'list' 'detail';
            gap: var(--nue-gap-lg);
        }
    }
}

.nue-div--collection-list {
    flex-direction: column;
    gap: var(--nue-gap-xs);
    overflow: hidden;

    > .nue-div--header {
        align-items: center;
        justify-content: space-between;
        font-size: var(--nue-text-sm);

        > .nue-div--title {
            gap: var(--nue-gap-xs);
            align-items: center;

            > .nue-icon {
                font-size: var(--nue-text-df);
            }

            > .nue-text--title {
                font-size: var(--nue-text-df2);
            }
        }

        > .nue-text--count {
            color: var(--nue-primary-color-600);
        }
    }

    > .nue-div--main {
        flex-direction: column;
        flex: auto;
        overflow-y: auto;

        > .nue-div--empty {
            justify-content: center;
            align-items: center;
            padding: var(--nue-padding-df);
            color: var(--nue-primary-color-400);
            font-size: var(--nue-text-xs);
        }

        > .nue-div--rows {
            flex-direction: column;
            gap: var(--nue-gap-2xs);
        }
    }
}

.nue-div--collection-row {
    align-items: center;
    justify-content: space-between;
    gap: var(--nue-gap-2xs);
    width: 100%;
    overflow: hidden;
    padding: var(--nue-padding-sm);
    border: none;
    background-color: var(--nue-primary-color-100);
    box-shadow: none;
    cursor: pointer;

    &[data-selected='true'] {
        background-color: var(--nue-primary-color-200);
    }

    > .nue-text--name {
        font-size: var(--nue-text-df2);
        font-weight: 500;
        flex: auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    > .nue-text--meta {
        font-size: var(--nue-text-sm);
        color: var(--nue-primary-color-600);
        flex: none;
        white-space: nowrap;
    }
}

.nue-div--collection-detail {
    flex-direction: column;
    overflow-y: auto;

    > .nue-div--empty {
        flex: auto;
        justify-content: center;
        align-items: center;
        color: var(--nue-primary-color-400);
        font-size: var(--nue-text-sm);
    }

    > .nue-div--detail-card {
        flex-direction: column;
        gap: var(--nue-gap-df);
        width: 100%;

        > .nue-div--detail-header {
            align-items: baseline;
            gap: var(--nue-gap-xs);

            > .nue-text--detail-name {
                font-size: var(--nue-text-lg);
                font-weight: 600;
            }

            > .nue-text--detail-type {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
            }

            > .nue-button {
                margin-left: auto;
                align-self: center;
            }
        }

        > .nue-text--detail-description {
            font-size: var(--nue-text-sm);
            color: var(--nue-primary-color-600);
            word-break: break-word;
        }

        > .nue-div--detail-field {
            align-items: center;
            justify-content: space-between;
            font-size: var(--nue-text-sm);

            > .nue-text--label {
                color: var(--nue-primary-color-600);
            }

            > .nue-text--value {
                color: var(--nue-primary-color-900);
            }
        }

        > .nue-div--records {
            flex-direction: column;
            gap: var(--nue-gap-xs);

            > .nue-div--records-header {
                align-items: center;
                justify-content: space-between;
                font-size: var(--nue-text-sm);

                > .nue-text--records-title {
                    font-size: var(--nue-text-df2);
                }

                > .nue-text--records-count {
                    color: var(--nue-primary-color-600);
                }
            }

            > .nue-div--records-main {
                flex-direction: column;
                gap: var(--nue-gap-2xs);
                font-size: var(--nue-text-sm);

                > .nue-div--records-tip {
                    justify-content: center;
                    align-items: center;
                    padding: var(--nue-padding-df);
                    color: var(--nue-primary-color-400);
                    font-size: var(--nue-text-xs);
                }

                > .nue-div--records-rows {
                    flex-direction: column;
                    gap: var(--nue-gap-2xs);
                }
            }

            > .nue-div--records-footer {
                justify-content: flex-end;
            }
        }
    }
}
</style>