<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import { MONTH_VALUES, monthFirstDateKey, offsetYear } from './month-jump'

/**
 * C2-F9 年-月跳转网格（TASK-09：month-jump-panel 逻辑迁移为 NueDropdown 内容）
 * @description 仅承载年月选择内容（年区 ±1 步进 + 12 月格 + 今天年月高亮），
 *              不含定位/开合/关闭监听——弹层由 NueDropdown 承担（Esc/外点/closeWhenExecuted）。
 *              月格 data-executeid = "YYYY-MM-01"（monthFirstDateKey），经 NueDropdown
 *              execute 委托上抛并由父级 useMonthJump 解析为 (year, month)。
 *              展示层标记 .cal-month-jump（供 C1-F8 抑制谓词命中其所在 NueDropdown）。
 */
defineOptions({ name: 'CalendarMonthGrid' })

const props = defineProps<{
    /** 锚点年（打开时可视年复位到该值；月=当前月年 / 周=选中日年） */
    anchorYear: number
    /** 弹层开合（true 时复位可视年） */
    active: boolean
}>()

// @states 网格内可视年（打开时以锚点年复位；±1 步进）
const viewYear = ref(props.anchorYear)

// @computed 今天年月（当前年/月格高亮标识）
const nowYear = computed(() => dayjs().year())
const nowMonth = computed(() => dayjs().month() + 1)

// @watch 弹层打开：复位可视年到锚点年（与旧面板打开语义一致）
watch(
    () => props.active,
    (active) => {
        if (active) viewYear.value = props.anchorYear
    }
)
</script>

<template>
    <div class="cal-month-jump" role="group" aria-label="跳转到年月">
        <!-- 年区：±1 年（不携带 data-executeid，点按不关闭弹层） -->
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
        <!-- 月区：1~12 月格（今天年月高亮；data-executeid 供 NueDropdown 即时跳转+关闭） -->
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
                :data-executeid="monthFirstDateKey(viewYear, month)"
            >
                {{ month }} 月
            </button>
        </div>
    </div>
</template>

<style scoped>
/* 年-月跳转网格内容（外层卡片/定位由 NueDropdown ul 提供，本文件仅网格布局与格样式） */
.cal-month-jump {
    width: 240px;
    padding: 2px 6px;
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

/* 今天年月高亮（今天所在年/月格） */
.mjp__month--current {
    background: color-mix(in srgb, var(--nue-primary-text-color) 88%, var(--nue-primary-color-0));
    color: var(--nue-primary-color-0);
    font-weight: 600;
}
</style>