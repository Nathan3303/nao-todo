<script setup lang="ts">
import {
    NaoSmartList,
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared'
import { ref, inject, watch, nextTick, onMounted } from 'vue'
import useCalendarSmartList from './use-calendar-smart-list'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarAside' })

const { isDisplayAside, dialogManager, hideCompleted, weekStart, setWeekStart } =
    inject(CALENDAR_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!
const { projectOptions, tagOptions, selectedProjectIds, selectedTagIds } = useCalendarSmartList()
const collapseItemsRecord = ref(['projects', 'tags'])

// 恢复侧边栏显示：与任务页 aside 一致，展开应用左侧子栏以承载筛选内容
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <nue-div theme="smart-list-wrapper">
                <nue-collapse v-model="collapseItemsRecord" theme="menu">
                    <nao-smart-list
                        collapse-item-name="projects"
                        name="清单"
                        :count="projectOptions.length"
                        manage-btn-tooltip="管理清单"
                        create-btn-tooltip="新建清单"
                        @manage="dialogManager.open(PROJECT_MANAGER_DIALOG_KEY)"
                        @create="dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)"
                    >
                        <template #actions></template>
                        <nue-checkbox-group v-model="selectedProjectIds">
                            <nue-checkbox
                                v-for="p in projectOptions"
                                :key="p.id"
                                :name="p.id"
                                :label="p.name"
                            />
                        </nue-checkbox-group>
                    </nao-smart-list>
                    <nao-smart-list
                        collapse-item-name="tags"
                        name="标签"
                        :count="tagOptions.length"
                        manage-btn-tooltip="管理标签"
                        create-btn-tooltip="新建标签"
                        @manage="dialogManager.open(TAG_MANAGER_DIALOG_KEY)"
                        @create="dialogManager.open(TAG_CREATOR_DIALOG_KEY)"
                    >
                        <template #actions></template>
                        <nue-checkbox-group v-model="selectedTagIds">
                            <nue-checkbox
                                v-for="t in tagOptions"
                                :key="t.id"
                                :name="t.id"
                                :label="t.name"
                            />
                        </nue-checkbox-group>
                    </nao-smart-list>
                </nue-collapse>
            </nue-div>
            <nue-divider />
            <nue-div align="center" class="hide-completed-row">
                <nue-checkbox v-model="hideCompleted">隐藏已完成</nue-checkbox>
            </nue-div>
            <nue-div align="center" class="weekstart-row" gap="8px">
                <nue-text size="var(--nue-text-sm)" class="weekstart-label">周起始</nue-text>
                <nue-div class="weekstart-toggle" role="group" aria-label="周起始">
                    <nue-button
                        theme="small,ghost"
                        class="weekstart-btn"
                        :class="{ 'is-active': weekStart === 'sunday' }"
                        @click="setWeekStart('sunday')"
                    >
                        周日
                    </nue-button>
                    <nue-button
                        theme="small,ghost"
                        class="weekstart-btn"
                        :class="{ 'is-active': weekStart === 'monday' }"
                        @click="setWeekStart('monday')"
                    >
                        周一
                    </nue-button>
                </nue-div>
            </nue-div>
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--aside-wrapper {
    flex: auto;

    > .hide-completed-row {
        width: 100%;
        padding: 0.25rem 0;

        /* 与 smart-list 内 checkbox 一致：默认字号/色值 + 去除默认横向内距保持左对齐 */
        .nue-checkbox {
            padding: 0;
        }
    }

    > .weekstart-row {
        width: 100%;
        padding: 0.25rem 0 0.5rem;

        .weekstart-label {
            color: color-mix(
                in srgb,
                var(--nue-primary-text-color) 62%,
                var(--nue-primary-color-0)
            );
            flex: none;
        }

        .weekstart-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0;
            border: 1px solid var(--nue-border-color);
            border-radius: var(--nue-primary-radius);
            overflow: hidden;

            .weekstart-btn {
                border-radius: 0 !important;
            }

            .weekstart-btn.is-active {
                background: color-mix(
                    in srgb,
                    var(--nue-primary-text-color) 9%,
                    var(--nue-primary-color-0)
                );
                color: var(--nue-primary-text-color);
                font-weight: 600;
            }
        }
    }

    > .nue-div--smart-list-wrapper {
        width: 100%;
        flex-direction: column;

        .nue-collapse--menu {
            gap: 0;

            .nue-collapse-item {
                border: none;
            }

            .nue-checkbox {
                padding: 0;
            }
        }
    }
}
</style>