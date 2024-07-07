<template>
    <div class="overview-wrapper">
        <nue-div class="pinned-tasks" vertical theme="card">
            <nue-text>Pinned Tasks</nue-text>
            <nue-divider> </nue-divider>
            <nue-div vertical gap="12px" align="stretch">
                <nue-text size="12px" color="gray" align="center">No pinned tasks</nue-text>
            </nue-div>
        </nue-div>
        <nue-div class="state-overview" vertical theme="card">
            <nue-text>State Overview</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical gap="12px">
                <nue-div align="center" flex gap="8px">
                    <nue-icon name="todo" size="18px"></nue-icon>
                    <nue-text size="16px"> Total </nue-text>
                    <nue-text style="margin-left: auto"> {{ countInfo.total || 0 }} </nue-text>
                </nue-div>
                <nue-div align="center" flex gap="8px">
                    <nue-icon name="circle" size="18px"></nue-icon>
                    <nue-text size="16px"> To Do </nue-text>
                    <nue-text style="margin-left: auto">
                        {{ countInfo.byState.todo || 0 }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" flex gap="8px">
                    <nue-icon name="in-progress" size="18px"></nue-icon>
                    <nue-text size="16px"> In Progress </nue-text>
                    <nue-text style="margin-left: auto">
                        {{ countInfo.byState['in-progress'] || 0 }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" flex gap="8px">
                    <nue-icon name="success" size="18px"></nue-icon>
                    <nue-text size="16px"> Done </nue-text>
                    <nue-text style="margin-left: auto">
                        {{ countInfo.byState.done || 0 }}
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
        <nue-div class="third-block" vertical theme="card">
            <nue-text>Third Block</nue-text>
            <nue-divider></nue-divider>
        </nue-div>
        <nue-div class="fourth-block" vertical theme="card">
            <nue-text>Project Details</nue-text>
            <nue-divider></nue-divider>
            <nue-div vertical>
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Id </nue-text>
                    <nue-text size="14px"> {{ project?.id }} </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Name </nue-text>
                    <nue-text size="14px"> {{ project?.name }} </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px">
                    <nue-text size="12px" color="gray"> Description </nue-text>
                    <nue-text size="14px">
                        {{ project?.description || 'No description' }}
                    </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="6px" flex>
                    <nue-text size="12px" color="gray"> Created by </nue-text>
                    <nue-div align="center" gap="6px">
                        <nue-avatar
                            src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                        ></nue-avatar>
                        <nue-text size="12px">Nathan</nue-text>
                    </nue-div>
                </nue-div>
                <nue-div wrap="nowrap">
                    <nue-div vertical align="stretch" gap="4px" flex>
                        <nue-text size="12px" color="gray"> Created at </nue-text>
                        <nue-text size="14px">
                            {{ moment(project?.createAt).format('YYYY-MM-DD HH:mm:ss') }}
                        </nue-text>
                    </nue-div>
                    <nue-div vertical align="stretch" gap="4px" flex>
                        <nue-text size="12px" color="gray"> Updated at </nue-text>
                        <nue-text size="14px">
                            {{ moment(project?.updateAt).format('YYYY-MM-DD HH:mm:ss') }}
                        </nue-text>
                    </nue-div>
                </nue-div>
            </nue-div>
        </nue-div>
    </div>
</template>

<script setup lang="ts">
import type { Project, TodoCountInfo } from '@/stores'
import moment from 'moment';

defineProps<{ countInfo: TodoCountInfo; project: Project }>()
</script>

<style scoped>
.overview-wrapper {
    width: 100%;
    height: 100%;
    /* overflow: hidden; */
    display: grid;
    grid-template-columns: 3fr 2fr;
    grid-template-rows: auto 64px 1fr;
    grid-gap: 16px;

    & > .nue-div {
        &:hover {
            box-shadow: 0 2px 3px rgba(100, 100, 100, 0.3);
        }
    }

    .pinned-tasks {
        grid-column: 1;
        grid-row: 1 / 3;
    }

    .state-overview {
        grid-column: 2;
        grid-row: 1;
    }

    .third-block {
        grid-column: 1;
    }

    .fourth-block {
        grid-column: 2;
        grid-row: 2 / 4;
    }
}
</style>
