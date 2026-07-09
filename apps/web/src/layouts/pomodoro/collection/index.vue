<script setup lang="ts">
import dayjs from 'dayjs'
import { usePomodoroCollection } from './use-pomodoro-collection'
import { PomodoroHeader } from '../header'

defineOptions({ name: 'PomodoroCollectionPage' })

const { loading, selectedId, pomodoros, selectedPomodoro, handleSelect } = usePomodoroCollection()

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
                                <nue-div theme="name-and-type">
                                    <nue-text theme="name" :clamped="1">{{ item.name }}</nue-text>
                                    <nue-text theme="type">{{ typeToString(item.type) }}</nue-text>
                                </nue-div>
                                <nue-text theme="duration">
                                    {{ durationToString(item.duration) }}
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
                        </nue-div>
                        <nue-text
                            v-if="selectedPomodoro.description"
                            theme="detail-description"
                        >
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

    > .nue-div--name-and-type {
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        overflow: hidden;
        flex: auto;

        > .nue-text--name {
            font-size: var(--nue-text-df2);
            font-weight: 500;
        }

        > .nue-text--type {
            font-size: var(--nue-text-sm);
            color: var(--nue-primary-color-600);
        }
    }

    > .nue-text--duration {
        font-size: var(--nue-text-df2);
        color: var(--nue-primary-color-600);
        flex: none;
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
    }
}
</style>
