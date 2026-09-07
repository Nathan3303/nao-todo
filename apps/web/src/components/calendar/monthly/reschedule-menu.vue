<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { todayDateKey } from './monthly-layout'
import { dateKeyOffset } from './reschedule'

/**
 * F4 快速改期菜单（月/周任务条右键+三点、抽屉行「安排到…」共用同一组件/同一命令）
 * @description Teleport 固定定位小菜单；项=今天/明天/[下周同日（已排期专用）]/选择日期…
 *              （日期面板复用 M1 含过去日期口径，直接落）；外点/Esc 关闭；busy 期全项禁用（防连点）。
 */
defineOptions({ name: 'CalendarRescheduleMenu' })

const props = defineProps<{
    open: boolean
    x: number
    y: number
    /** 已排期（含 endAt）→ 含「下周同日」四项；未安排 → 裁剪为三项 */
    scheduled: boolean
    /** 该任务排期中（写回进行）→ 禁用菜单项防连点 */
    busy: boolean
    /** 锚点日键（endAt 所在日；「下周同日」= +7 天，仅 scheduled 使用） */
    anchorKey?: string
}>()
const emit = defineEmits<{
    (e: 'select', dateKey: string): void
    (e: 'close'): void
}>()

// @computed 今天/明天/下周同日目标键
const todayKey = (): string => todayDateKey()
const tomorrowKey = (): string => dayjs().add(1, 'day').format('YYYY-MM-DD')
const nextWeekKey = (): string =>
    props.anchorKey ? dateKeyOffset(props.anchorKey, 7) : dateKeyOffset(todayKey(), 7)

// @computed 快捷项（下周同日仅已排期任务；未安排行裁剪）
const quickItems = computed(() => {
    const items = [
        { key: todayKey(), label: '今天' },
        { key: tomorrowKey(), label: '明天' }
    ]
    if (props.scheduled) items.push({ key: nextWeekKey(), label: '下周同日' })
    return items
})

// @states 「选择日期…」展开面板
const dateOpen = ref(false)
const pickDate = ref('')

// @method ISO（NueDatePicker 输出）-> YYYY-MM-DD
const keyOfIso = (iso: string): string => dayjs(iso).format('YYYY-MM-DD')

// @method 「选择日期…」展开/收起
const toggleDatePanel = (): void => {
    dateOpen.value = !dateOpen.value
    pickDate.value = ''
}

// @method 快捷项/日期面板确定：上抛目标日键
const pickQuick = (key: string): void => {
    if (props.busy || !key) return
    emit('select', key)
}
const confirmDate = (): void => {
    if (props.busy || !pickDate.value) return
    emit('select', keyOfIso(pickDate.value))
}

// —— 外点/Esc 关闭（开启时挂载，关闭/卸载摘除） ——

const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    if (!target) return
    // 命中本菜单或 Nue 弹层容器（日期面板所在 popup-pool）不关闭，其余视为外点
    if (target.closest('.rmenu')) return
    if (target.closest('.nue-popup-pool')) return
    emit('close')
}
const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') emit('close')
}

watch(
    () => props.open,
    (open) => {
        if (open) {
            window.addEventListener('pointerdown', onPointerDown, true)
            window.addEventListener('keydown', onKeyDown)
        } else {
            window.removeEventListener('pointerdown', onPointerDown, true)
            window.removeEventListener('keydown', onKeyDown)
        }
    },
    { immediate: true }
)
onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
    <teleport to="body">
        <div v-if="open" class="rmenu" :style="{ left: `${x}px`, top: `${y}px` }" role="menu">
            <nue-button
                v-for="item in quickItems"
                :key="item.label"
                theme="pure,small"
                class="rmenu__item"
                role="menuitem"
                :disabled="busy"
                @click="pickQuick(item.key)"
            >
                {{ item.label }}
            </nue-button>
            <nue-divider class="rmenu__sep" />
            <nue-button
                theme="pure,small"
                class="rmenu__item"
                :class="{ 'is-on': dateOpen }"
                :disabled="busy"
                role="menuitem"
                @click="toggleDatePanel"
            >
                选择日期…
            </nue-button>
            <!-- 选择日期面板（含过去日期，直接落） -->
            <div v-if="dateOpen" class="rmenu__date">
                <nue-date-picker
                    v-model="pickDate"
                    class="rmenu__picker"
                    type="date"
                    size="small"
                    placeholder="选择日期"
                />
                <nue-button
                    theme="primary,small"
                    :disabled="!pickDate || busy"
                    @click="confirmDate"
                >
                    确定
                </nue-button>
            </div>
        </div>
    </teleport>
</template>

<style scoped>
/* 快速改期菜单（与日历风格一致：主题令牌 + 轻面板） */
.rmenu {
    position: fixed;
    z-index: 1000;
    min-width: 132px;
    max-width: 200px;
    padding: 4px;
    background: var(--nue-primary-color-0);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius, 8px);
    box-shadow: 0 6px 18px color-mix(in srgb, var(--nue-primary-color-900) 14%, transparent);
    box-sizing: border-box;
}

.rmenu__item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 5px 8px;
    border-radius: 4px;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm, 0.8125rem);
    line-height: 1.4;
    cursor: pointer;
    transition: background 60ms;
}

.rmenu__item:hover:not(:disabled) {
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
}

.rmenu__item.is-on {
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
}

.rmenu__item:disabled {
    opacity: 0.5;
    cursor: default;
}

.rmenu__sep {
    margin: 4px 2px;
}

.rmenu__date {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 2px 2px;
}

.rmenu__picker {
    flex: 1;
    min-width: 0;
}
</style>