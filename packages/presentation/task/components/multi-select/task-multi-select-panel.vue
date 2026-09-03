<script setup lang="ts">
import { computed, ref } from 'vue'
import { ComboBox, Loading, t, TaskSelector } from '@nao-todo/shared'
import { TaskPrioritySelectOptions, TaskStateSelectOptions } from '../../constants'
import { TaskProjectSelector } from '../project-selector'
import { useTaskMultiSelectPanel } from './use-task-multi-select-panel'
import type { TaskMultiSelectPanelEmits, TaskMultiSelectPanelProps } from './types'

defineOptions({ name: 'TaskMultiSelectPanel' })
const props = defineProps<TaskMultiSelectPanelProps>()
const emit = defineEmits<TaskMultiSelectPanelEmits>()

const {
    executor,
    selectedTasks,
    hasTrashedTask,
    actionsDisabled,
    handleSetState,
    handleSetPriority,
    handleSetEndAt,
    handleMoveProject,
    handleAddTag,
    handleRemoveTag,
    handleDelete,
    handleRestore,
    handleGiveUp,
    handleUngiveUp
} = useTaskMultiSelectPanel(props, emit)

// @computed 抽屉显隐
const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// @ref 结束日期 - 用户已确认但尚未写入的中间值；用于触发 useTaskMultiSelectPanel 的批量更新
const endAt = ref<string | null>(null)
// @ref 标记是否已就绪（v-model 已被用户改动） - 关闭浮层时仅在有变化时提交
const endAtDirty = ref<boolean>(false)

// @computed 可添加标签（未被全部选中任务同时含有的标签）
const addableTags = computed(() => {
    const selected = selectedTasks.value
    if (!selected.length) return []
    return props.tags
        .filter((tag) => selected.some((task) => !(task.tags ?? []).includes(tag.id)))
        .map((tag) => ({ label: tag.name, value: tag.id, checked: false }))
})

// @computed 可移除标签（至少一个选中任务含有的标签）
const removableTags = computed(() => {
    const selected = selectedTasks.value
    if (!selected.length) return []
    return props.tags
        .filter((tag) => selected.some((task) => (task.tags ?? []).includes(tag.id)))
        .map((tag) => ({ label: tag.name, value: tag.id, checked: false }))
})

// @computed 标签下拉刷新令牌（批量写入后重置勾选状态）
const tagsRefreshKey = computed(() => {
    const tagSign = selectedTasks.value.map((task) => (task.tags ?? []).join(',')).join('|')
    return `${props.selectedIds.join(',')}-${tagSign}`
})

// @method 添加标签变更
const handleAddTagChange = async (value: unknown, { checked }: { checked?: boolean }) => {
    if (!checked || actionsDisabled.value) return
    await handleAddTag(String(value))
}

// @method 移除标签变更
const handleRemoveTagChange = async (value: unknown, { checked }: { checked?: boolean }) => {
    if (!checked || actionsDisabled.value) return
    await handleRemoveTag(String(value))
}

// @method 结束日期输入 - 仅记录中间值，不触发批量写入
const handleEndAtInput = () => {
    endAtDirty.value = true
}

// @method 结束日期清空 - 仅记录中间值，不触发批量写入
const handleEndAtClear = () => {
    endAt.value = null
    endAtDirty.value = true
}

// @method 结束日期关闭 - 用户关闭日历浮层时统一提交；close 事件不带值，从 ref 读取
const handleEndAtClose = async () => {
    if (actionsDisabled.value || !endAtDirty.value) return
    endAtDirty.value = false
    const value = endAt.value
    await handleSetEndAt(value ?? null)
}
</script>

<template>
    <nue-drawer
        v-model="visible"
        theme="float-aside"
        span="min(100%,360px)"
        min-span="320px"
        allow-close-by-overlay
    >
        <div class="ms-panel">
            <!-- 面板头部 -->
            <header class="ms-panel__header">
                <div class="ms-panel__header-row">
                    <div class="ms-panel__title-block">
                        <span class="ms-panel__title">{{ t('task.multiSelect.batchTitle') }}</span>
                        <span class="ms-panel__counter">
                            {{ t('task.multiSelect.title', { n: props.selectedIds.length }) }}
                        </span>
                    </div>
                    <nue-button icon="close" theme="icon,ghost,pure" @click="visible = false" />
                </div>
                <transition name="ms-alert">
                    <div v-if="hasTrashedTask" class="ms-panel__alert" role="alert">
                        <nue-icon name="warning" size="14px" />
                        <span>{{ t('task.multiSelect.blockedByTrashed') }}</span>
                    </div>
                </transition>
            </header>
            <hr class="ms-panel__divider" />

            <!-- 主体：属性批量修改 -->
            <main class="ms-panel__main">
                <section class="ms-panel__section">
                    <h6 class="ms-panel__section-title">{{ t('task.multiSelect.properties') }}</h6>

                    <div class="ms-row">
                        <label class="ms-row__label">{{ t('task.multiSelect.state') }}</label>
                        <div class="ms-row__control">
                            <task-selector
                                :disabled="actionsDisabled"
                                :options="TaskStateSelectOptions"
                                :placeholder="t('task.multiSelect.setTo')"
                                @change="handleSetState"
                            />
                        </div>
                    </div>

                    <div class="ms-row">
                        <label class="ms-row__label">{{ t('task.multiSelect.priority') }}</label>
                        <div class="ms-row__control">
                            <task-selector
                                :disabled="actionsDisabled"
                                :options="TaskPrioritySelectOptions"
                                :placeholder="t('task.multiSelect.setTo')"
                                @change="handleSetPriority"
                            />
                        </div>
                    </div>

                    <div class="ms-row">
                        <label class="ms-row__label">{{ t('task.multiSelect.endAt') }}</label>
                        <div class="ms-row__control">
                            <nue-date-picker
                                v-model="endAt"
                                :disabled="actionsDisabled"
                                type="datetime"
                                clearable
                                size="small"
                                @update:model-value="handleEndAtInput"
                                @clear="handleEndAtClear"
                                @close="handleEndAtClose"
                            />
                        </div>
                    </div>

                    <div class="ms-row">
                        <label class="ms-row__label">
                            {{ t('task.multiSelect.moveToProject') }}
                        </label>
                        <div class="ms-row__control">
                            <task-project-selector
                                :projects="projects"
                                project-id=""
                                @select="handleMoveProject"
                            />
                        </div>
                    </div>

                    <div class="ms-row">
                        <label class="ms-row__label">{{ t('task.multiSelect.tags') }}</label>
                        <div class="ms-row__control ms-row__control--tags">
                            <combo-box
                                :key="`add-${tagsRefreshKey}`"
                                :framework="addableTags"
                                :trigger-title="t('task.multiSelect.addTags')"
                                hide-counter
                                @change="handleAddTagChange"
                            />
                            <combo-box
                                :key="`remove-${tagsRefreshKey}`"
                                :framework="removableTags"
                                :trigger-title="t('task.multiSelect.removeTags')"
                                hide-counter
                                @change="handleRemoveTagChange"
                            />
                        </div>
                    </div>
                </section>
            </main>

            <!-- 底部操作托盘 -->
            <footer class="ms-panel__footer">
                <div class="ms-actions">
                    <nue-button
                        class="ms-action"
                        icon="restore"
                        theme="small"
                        :disabled="actionsDisabled"
                        :title="t('task.multiSelect.ungiveUp')"
                        @click="handleUngiveUp"
                    >
                        {{ t('task.multiSelect.ungiveUp') }}
                    </nue-button>
                    <nue-button
                        class="ms-action ms-action--warning"
                        icon="clear"
                        theme="small"
                        :disabled="actionsDisabled"
                        :title="t('task.multiSelect.giveUp')"
                        @click="handleGiveUp"
                    >
                        {{ t('task.multiSelect.giveUp') }}
                    </nue-button>
                    <span class="ms-actions__divider" aria-hidden="true" />
                    <nue-button
                        class="ms-action"
                        icon="undo"
                        theme="small"
                        :disabled="actionsDisabled"
                        :title="t('task.multiSelect.restore')"
                        @click="handleRestore"
                    >
                        {{ t('task.multiSelect.restore') }}
                    </nue-button>
                    <nue-button
                        class="ms-action ms-action--danger"
                        icon="delete"
                        theme="small"
                        :disabled="actionsDisabled"
                        :title="t('task.multiSelect.delete')"
                        @click="handleDelete"
                    >
                        {{ t('task.multiSelect.delete') }}
                    </nue-button>
                    <transition name="ms-loading">
                        <div v-if="executor.isRunning.value" class="ms-actions__loading">
                            <loading size="12px" />
                            <span class="ms-actions__loading-text">
                                {{ t('task.multiSelect.processing') }}
                            </span>
                        </div>
                    </transition>
                </div>
            </footer>
        </div>
    </nue-drawer>
</template>

<style scoped>
/* === 容器 === */
.ms-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #ffffff;
    font-size: 14px;
    line-height: 1.5;
    color: rgb(55, 53, 47);
    font-family:
        -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', 'PingFang SC',
        'Microsoft YaHei', sans-serif;
}

/* === 头部 === */
.ms-panel__header {
    flex-shrink: 0;
    padding: 14px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ms-panel__header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.ms-panel__title-block {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.ms-panel__title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: rgb(35, 35, 35);
}

.ms-panel__counter {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 10px;
    background-color: rgba(55, 53, 47, 0.06);
    color: rgba(55, 53, 47, 0.65);
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
}

.ms-panel__alert {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 4px;
    background-color: rgba(212, 76, 71, 0.08);
    color: rgb(212, 76, 71);
    font-size: 12.5px;
    line-height: 1.4;
}

.ms-panel__divider {
    margin: 0;
    border: 0;
    height: 1px;
    background-color: rgba(55, 53, 47, 0.08);
    flex-shrink: 0;
}

/* === 主体：属性编辑 === */
.ms-panel__main {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 16px 18px;
}

.ms-panel__section {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ms-panel__section-title {
    margin: 0 0 6px;
    padding: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(55, 53, 47, 0.45);
    user-select: none;
}

.ms-row {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 4px 4px 4px 6px;
    border-radius: 4px;
    transition: background-color 0.08s ease;
}

.ms-row:hover {
    background-color: rgba(55, 53, 47, 0.03);
}

.ms-row__label {
    flex: 0 0 78px;
    font-size: 13px;
    color: rgba(55, 53, 47, 0.7);
    user-select: none;
}

.ms-row__control {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
}

.ms-row__control--tags {
    gap: 6px;
}

/* === 底部操作托盘 === */
.ms-panel__footer {
    flex-shrink: 0;
    padding: 10px 14px 12px;
    border-top: 1px solid rgba(55, 53, 47, 0.08);
    background-color: #fbfbfa;
}

.ms-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}

.ms-action {
    border-radius: 4px !important;
    transition:
        background-color 0.08s ease,
        color 0.08s ease;
}

.ms-action:not(:disabled):hover {
    background-color: rgba(55, 53, 47, 0.06) !important;
}

.ms-action:not(:disabled):active {
    background-color: rgba(55, 53, 47, 0.1) !important;
}

.ms-action--warning :deep(.nue-icon) {
    color: #d4a72c;
}

.ms-action--danger :deep(.nue-icon) {
    color: rgb(212, 76, 71);
}

.ms-action--danger:not(:disabled):hover {
    background-color: rgba(212, 76, 71, 0.08) !important;
}

.ms-actions__divider {
    width: 1px;
    height: 18px;
    background-color: rgba(55, 53, 47, 0.1);
    margin: 0 4px;
}

.ms-actions__loading {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background-color: rgba(55, 53, 47, 0.05);
    color: rgba(55, 53, 47, 0.55);
    font-size: 12px;
}

.ms-actions__loading-text {
    line-height: 1;
}

/* === 过渡 === */
.ms-alert-enter-active,
.ms-alert-leave-active {
    transition:
        opacity 0.18s ease,
        transform 0.18s ease;
}

.ms-alert-enter-from,
.ms-alert-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}

.ms-loading-enter-active,
.ms-loading-leave-active {
    transition: opacity 0.18s ease;
}

.ms-loading-enter-from,
.ms-loading-leave-to {
    opacity: 0;
}
</style>