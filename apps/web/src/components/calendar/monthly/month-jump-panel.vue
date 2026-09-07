<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MONTH_VALUES, offsetYear } from './month-jump'

/**
 * C2-F9 年-月跳转面板（月视图标题 / 周视图标题共用）
 * @description 弹层含「当前年/月高亮」；Esc/外点关闭（无副作用）；再点标题由父级 toggle 收起。
 *              焦点管理：打开聚焦面板容器、关闭由父级归还标题按钮。月格点击=即时跳转（无二次确认）。
 *              弹层标记 .month-jump-panel（供 C1-F8 抑制谓词命中，弹层开启期间导航键抑制）。
 */
defineOptions({ name: 'CalendarMonthJumpPanel' })

const props = defineProps<{
    open: boolean
    anchorYear: number
    anchorMonth: number
    x: number
    y: number
}>()
const emit = defineEmits<{
    (e: 'select', year: number, month: number): void
    (e: 'close'): void
}>()

// @states 面板内可视年（打开时以锚点年复位；±1 步进）
const viewYear = ref(props.anchorYear)
const panelRef = ref<HTMLElement | null>(null)

// @computed 今天年月（当前年/月格高亮标识）
const nowYear = computed(() => dayjs().year())
const nowMonth = computed(() => dayjs().month() + 1)

// @watch 打开：复位可视年到锚点年并把焦点移入面板（父级关闭时归还标题按钮）
watch(
    () => props.open,
    async (open) => {
        if (!open) return
        viewYear.value = props.anchorYear
        await nextTick()
        panelRef.value?.focus()
    },
    { immediate: true }
)

// @method 月格即时跳转
const pickMonth = (month: number): void => {
    emit('select', viewYear.value, month)
}

// —— Esc / 外点关闭 ——

const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') emit('close')
}
const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    if (!target) return
    // 面板自身与触发器（标题按钮 data-mjp-trigger，toggle 由父级处理）不视为外点
    if (target.closest('.month-jump-panel')) return
    if (target.closest('[data-mjp-trigger]')) return
    emit('close')
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
        <div
            v-if="open"
            ref="panelRef"
            class="mjp month-jump-panel"
            :style="{ left: `${x}px`, top: `${y}px` }"
            role="dialog"
            aria-label="跳转到年月"
            tabindex="-1"
        >
            <!-- 年区：±1 年 -->
            <div class="mjp__year" role="group" aria-label="年份">
                <button
                    type="button"
                    class="mjp__year-btn"
                    aria-label="上一年"
                    @click="viewYear = offsetYear(viewYear, -1)"
                >
                    ‹
                </button>
                <span class="mjp__year-text">{{ viewYear }} 年</span>
                <button
                    type="button"
                    class="mjp__year-btn"
                    aria-label="下一年"
                    @click="viewYear = offsetYear(viewYear, 1)"
                >
                    ›
                </button>
            </div>
            <!-- 月区：1~12 月格（当前年月高亮） -->
            <div class="mjp__months" role="grid" aria-label="选择月份">
                <button
                    v-for="month in MONTH_VALUES"
                    :key="month"
                    type="button"
                    class="mjp__month"
                    :class="{
                        'mjp__month--current': viewYear === nowYear && month === nowMonth
                    }"
                    role="gridcell"
                    @click="pickMonth(month)"
                >
                    {{ month }} 月
                </button>
            </div>
        </div>
    </teleport>
</template>

<style scoped>
/* 年月跳转面板（与 F4 菜单同风格令牌；fixed 顶层） */
.mjp {
    position: fixed;
    z-index: 1000;
    width: 240px;
    padding: 10px;
    background: var(--nue-primary-color-0);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-primary-radius, 8px);
    box-shadow: 0 6px 18px color-mix(in srgb, var(--nue-primary-color-900) 14%, transparent);
    outline: none;
    box-sizing: border-box;
    font-size: var(--nue-text-sm, 0.8125rem);
}

.mjp__year {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 8px;
}

.mjp__year-text {
    color: var(--nue-primary-text-color);
    font-weight: 600;
    line-height: 1.4;
}

.mjp__year-btn {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--nue-secondary-text-color);
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    transition: background 60ms;
}

.mjp__year-btn:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
}

.mjp__months {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.mjp__month {
    padding: 6px 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: color-mix(in srgb, var(--nue-primary-text-color) 5%, var(--nue-primary-color-0));
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-sm, 0.8125rem);
    line-height: 1.2;
    cursor: pointer;
    transition:
        background 60ms,
        border-color 60ms;
}

.mjp__month:hover,
.mjp__month:focus-visible {
    background: color-mix(in srgb, var(--nue-primary-text-color) 10%, var(--nue-primary-color-0));
    outline: 1px solid var(--nue-border-color);
}

/* 当前年月高亮（今天所在年/月格） */
.mjp__month--current {
    background: color-mix(in srgb, var(--nue-primary-text-color) 88%, var(--nue-primary-color-0));
    color: var(--nue-primary-color-0);
    font-weight: 600;
}
</style>