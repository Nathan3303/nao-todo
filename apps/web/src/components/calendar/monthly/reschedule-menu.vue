<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { todayDateKey } from './monthly-layout'
import { dateKeyOffset } from './reschedule'

/**
 * F4 快速改期菜单（TASK-10：内建 NueDropdown 承载；月/周任务条三点、抽屉「安排到…」共用同一命令）
 * @description NueDropdown + #trigger 触发器插槽（触发器由调用方提供：条三点 / 抽屉按钮）；
 *              项=今天/明天/[下周同日（已排期专用）]/选择日期…（日期面板含过去日期，直接落）。
 *              开合/定位/Esc/外点/closeWhenExecuted 由 NueDropdown 内建（替换手写 window 监听）；
 *              菜单项经 data-executeid 交由 NueDropdown execute 委托上抛；busy 期全项禁用（防连点）。
 *              同组 group="calendar-reschedule" 保证同一时刻仅一个改期菜单展开（跨条/抽屉）。
 */
defineOptions({ name: 'CalendarRescheduleMenu' })

const props = defineProps<{
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

// @method 「选择日期…」展开/收起（不带 execute-id，点按不关闭弹层）
const toggleDatePanel = (): void => {
    if (props.busy) return
    dateOpen.value = !dateOpen.value
    pickDate.value = ''
}

// @method 日期面板「确定」哨兵（带此 execute-id 时取 pickDate；其余 execute-id 即日期键）
const PICK_SENTINEL = '__pick__'

/**
 * @method NueDropdown execute 委托：快捷项 id = 日期键；确定项 id = 哨兵（取 pickDate）
 * @description closeWhenExecuted 已由 NueDropdown 负责收起；此处仅归一化目标日键并上抛 select。
 */
const onExecute = (id: string): void => {
    if (props.busy || !id) return
    if (id === PICK_SENTINEL) {
        if (!pickDate.value) return
        emit('select', keyOfIso(pickDate.value))
        return
    }
    emit('select', id)
}

// @method 弹层关闭（NueDropdown 内建 Esc/外点/execute）→ 复位日期面板并上抛 close（调用方复位态）
const onClose = (): void => {
    dateOpen.value = false
    pickDate.value = ''
    emit('close')
}
</script>

<template>
    <nue-dropdown
        placement="bottom-end"
        size="small"
        group="calendar-reschedule"
        close-when-executed
        @close="onClose"
        @execute="onExecute"
    >
        <template #trigger="{ trigger, visible }">
            <slot name="trigger" :trigger="trigger" :visible="visible" />
        </template>
        <div class="rmenu" role="menu">
            <button
                v-for="item in quickItems"
                :key="item.label"
                type="button"
                class="rmenu__item"
                role="menuitem"
                :disabled="busy"
                :data-executeid="item.key"
            >
                {{ item.label }}
            </button>
            <nue-divider class="rmenu__sep" />
            <button
                type="button"
                class="rmenu__item"
                :class="{ 'is-on': dateOpen }"
                :disabled="busy"
                role="menuitem"
                @click="toggleDatePanel"
            >
                选择日期…
            </button>
            <!-- 选择日期面板（含过去日期，直接落） -->
            <div v-if="dateOpen" class="rmenu__date">
                <nue-date-picker
                    v-model="pickDate"
                    class="rmenu__picker"
                    type="date"
                    size="small"
                    placeholder="选择日期"
                />
                <button
                    type="button"
                    class="rmenu__confirm"
                    :disabled="!pickDate || busy"
                    :data-executeid="PICK_SENTINEL"
                >
                    确定
                </button>
            </div>
        </div>
    </nue-dropdown>
</template>

<style scoped>
/* 快速改期菜单内容（外层卡片/定位由 NueDropdown 承担；此处仅项布局与项样式） */
.rmenu {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 112px;
}

.rmenu__item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    text-align: left;
    color: var(--nue-primary-text-color);
    font-family: inherit;
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
    margin: 2px 2px;
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

.rmenu__confirm {
    flex: none;
    padding: 4px 10px;
    border: none;
    border-radius: 4px;
    background: color-mix(in srgb, var(--nue-primary-text-color) 88%, var(--nue-primary-color-0));
    color: var(--nue-primary-color-0);
    font-family: inherit;
    font-size: var(--nue-text-sm, 0.8125rem);
    line-height: 1.4;
    cursor: pointer;
}

.rmenu__confirm:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>