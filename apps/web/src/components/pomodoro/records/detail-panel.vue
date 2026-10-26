<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import dayjs from 'dayjs'
import { formatDuration } from '@nao-todo/presentation/pomodoro'
import type { PomodoroRecordViewObject, PomodoroViewObject } from '@nao-todo/domain-pomodoro'

defineOptions({ name: 'PomodoroRecordsDetailPanel' })

/**
 * R13 / AC10：≤480px 时详情抽屉全宽。
 * 走 props 路径（span / min-span）：NueDrawer 把 span/minSpan 以**内联自定义属性**写到 .nue-drawer 上，
 * 纯 CSS 覆盖会被内联值压住（须 !important）⇒ 按视口宽度条件传 props 是唯一无 !important 的口子。
 * >480px 传 undefined ⇒ 组件默认（36% / 240px）⇒ 与现状逐项一致（桌面/平板零变化）。
 * 断点 480 = 既有次级断点（PRD R2 允许集 {480, 720, 721}）。
 */
const NARROW_QUERY = '(max-width: 480px)'
const narrowQuery = typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null
const isNarrow = ref(narrowQuery?.matches ?? false)
if (narrowQuery) {
    const syncNarrow = (event: MediaQueryListEvent) => {
        isNarrow.value = event.matches
    }
    narrowQuery.addEventListener('change', syncNarrow)
    onScopeDispose(() => narrowQuery.removeEventListener('change', syncNarrow))
}

const props = defineProps<{
    visible: boolean
    record: PomodoroRecordViewObject | null
    pomodoros: PomodoroViewObject[]
}>()

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'close'): void
}>()

const getPomodoroName = (pomodoroId: string | null) => {
    if (!pomodoroId) return '无'
    const pomodoro = props.pomodoros.find((p) => p.id === pomodoroId)
    return pomodoro?.name || '无'
}

const visible = computed({
    get: () => props.visible,
    set: (nv) => emit('update:visible', nv)
})

const typeLabel = computed(() => {
    if (!props.record) return '-'
    return props.record.type === 1 ? '番茄钟' : '正计时'
})

const formattedStartAt = computed(() => {
    if (!props.record) return '-'
    return dayjs(props.record.startAt).format('YYYY-MM-DD HH:mm:ss')
})

const formattedEndAt = computed(() => {
    if (!props.record) return '-'
    return dayjs(props.record.endAt).format('YYYY-MM-DD HH:mm:ss')
})

const formattedDuration = computed(() => {
    if (!props.record) return '-'
    return formatDuration(props.record.duration)
})

const handleClose = () => {
    emit('update:visible', false)
    emit('close')
}
</script>

<template>
    <nue-drawer
        v-model="visible"
        theme="right,records-full"
        title="专注详情"
        :span="isNarrow ? '100%' : undefined"
        :min-span="isNarrow ? '100%' : undefined"
        :allow-close-by-overlay="isNarrow"
        @after-close="handleClose"
    >
        <div v-if="record" class="pomodoro-records-detail__body">
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注类型</nue-text>
                    <nue-text theme="field-value">{{ typeLabel }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">任务名称</nue-text>
                    <nue-text theme="field-value">{{ record.taskName || '无关联任务' }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注模板</nue-text>
                    <nue-text theme="field-value">
                        {{ getPomodoroName(record.pomodoroId) }}
                    </nue-text>
                </div>
            </div>
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">开始时间</nue-text>
                    <nue-text theme="field-value">{{ formattedStartAt }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">结束时间</nue-text>
                    <nue-text theme="field-value">{{ formattedEndAt }}</nue-text>
                </div>
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">专注时长</nue-text>
                    <nue-text theme="field-value">{{ formattedDuration }}</nue-text>
                </div>
            </div>
            <div class="pomodoro-records-detail__section">
                <div class="pomodoro-records-detail__field">
                    <nue-text theme="field-label">会话 ID</nue-text>
                    <nue-text theme="field-value monospace">{{ record.sessionId }}</nue-text>
                </div>
            </div>
            <div v-if="record.note" class="pomodoro-records-detail__section">
                <nue-text theme="field-label">笔记</nue-text>
                <div class="pomodoro-records-detail__note">
                    <nue-text class="pomodoro-records-detail__note-text">{{
                        record.note
                    }}</nue-text>
                </div>
            </div>
        </div>
        <nue-empty v-else description="暂无专注记录详情" />
    </nue-drawer>
</template>

<style scoped>
.pomodoro-records-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.pomodoro-records-detail__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--nue-padding-md);
}

.pomodoro-records-detail__body {
    display: flex;
    flex-direction: column;
    flex: auto;
    gap: var(--nue-gap-md);
    padding: var(--nue-padding-md);
    overflow-y: auto;
}

.pomodoro-records-detail__section {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
}

.pomodoro-records-detail__field {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--nue-gap-md);
}

.pomodoro-records-detail__note {
    padding: var(--nue-padding-sm);
    background-color: var(--nue-primary-color-50);
    border-radius: var(--nue-radius-sm);
    line-height: 1.6;
}

/* R14/AC11：笔记正文明示 14px（--nue-text-sm，与其它字段值同号），保留原文换行且不撑破抽屉（无横向溢出） */
.pomodoro-records-detail__note-text {
    font-size: var(--nue-text-sm);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.nue-text--title {
    font-size: var(--nue-text-xl);
    font-weight: 600;
}

.nue-text--section-title {
    font-size: var(--nue-text-sm);
    font-weight: 500;
    color: var(--nue-primary-color-700);
}

.nue-text--field-label {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-600);
    flex: none;
}

.nue-text--field-value {
    font-size: var(--nue-text-sm);
    color: var(--nue-primary-color-900);
    text-align: right;
    flex: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.monospace {
        font-family: ui-monospace, 'Cascadia Mono', monospace;
        font-size: var(--nue-text-xs);
    }
}
</style>

<!-- 非 scoped：抽屉 Teleport 到 body，scoped 选择器够不到其内部；
     以下规则全部用本抽屉独有的 `nue-drawer--records-full`（theme 注入）命名空间，不外溢到其它抽屉/页面。 -->
<style>
/* R13 / AC10 —— 仅 ≤480px：抽屉全宽后遮罩被覆盖不可点，✕ 是主关闭路径，可点区须 ≥40px。
   ✕ 是 NueDrawer 内部按钮（theme=icon,ghost,small，28px），拿不到 props ⇒ 唯一非共享组件口子 =
   唯一 theme class 的全局窄屏 CSS。命中区手法同分页（R10）：28px + ::after 每侧 6px = 40px；
   overflow:visible 必须同给（.nue-button 基础样式 overflow:hidden 会把出盒伪元素裁掉）。
   >480px 无此规则 ⇒ 桌面/平板零变化。 */
@media (max-width: 480px) {
    .nue-drawer--records-full .nue-drawer__header .nue-button {
        position: relative;
        overflow: visible;
    }

    .nue-drawer--records-full .nue-drawer__header .nue-button::after {
        content: '';
        position: absolute;
        inset: -6px;
    }
}
</style>