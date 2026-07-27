<script setup lang="ts">
import { ref, computed } from 'vue'

defineOptions({ name: 'CalendarMonthly' })

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

interface DayCell {
    day: number
    date: string // ISO string YYYY-MM-DD
    isCurrentMonth: boolean
    isToday: boolean
    isSelected: boolean
    isWeekend: boolean
    hasTasks: boolean
    dots: { color: string }[]
}

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth()) // 0-indexed
const selectedDateStr = ref('')

const year = computed(() => currentYear.value)
const month = computed(() => currentMonth.value + 1)

function buildDays(): DayCell[] {
    const year = currentYear.value
    const month = currentMonth.value
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // First day of month
    const firstDay = new Date(year, month, 1)
    const startDayOfWeek = firstDay.getDay() // 0=Sun

    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const cells: DayCell[] = []

    // Previous month's trailing days
    const prevMonthStart = daysInPrevMonth - startDayOfWeek + 1
    for (let d = prevMonthStart; d <= daysInPrevMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({
            day: d,
            date: dateStr,
            isCurrentMonth: false,
            isToday: false,
            isSelected: selectedDateStr.value === dateStr,
            isWeekend: cells.length % 7 === 0 || cells.length % 7 === 6,
            hasTasks: d % 3 === 0,
            dots: d % 3 === 0 ? [{ color: 'var(--cal-dot-default)' }] : []
        })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const isToday = dateStr === todayStr
        cells.push({
            day: d,
            date: dateStr,
            isCurrentMonth: true,
            isToday,
            isSelected: selectedDateStr.value === dateStr,
            isWeekend: cells.length % 7 === 0 || cells.length % 7 === 6,
            hasTasks: d % 5 === 0 || d === 15,
            dots:
                d % 5 === 0
                    ? [{ color: 'var(--cal-dot-default)' }, { color: 'var(--cal-dot-accent)' }]
                    : d === 15
                      ? [{ color: 'var(--cal-dot-default)' }]
                      : []
        })
    }

    // Next month's leading days (fill to 6 rows = 42 cells)
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
        const dateStr = `${year}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({
            day: d,
            date: dateStr,
            isCurrentMonth: false,
            isToday: false,
            isSelected: selectedDateStr.value === dateStr,
            isWeekend: cells.length % 7 === 0 || cells.length % 7 === 6,
            hasTasks: false,
            dots: []
        })
    }

    return cells
}

const days = computed(() => buildDays())

function prevMonth() {
    if (currentMonth.value === 0) {
        currentMonth.value = 11
        currentYear.value--
    } else {
        currentMonth.value--
    }
}

function nextMonth() {
    if (currentMonth.value === 11) {
        currentMonth.value = 0
        currentYear.value++
    } else {
        currentMonth.value++
    }
}

function goToToday() {
    currentYear.value = now.getFullYear()
    currentMonth.value = now.getMonth()
    selectedDateStr.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function selectDate(day: DayCell) {
    selectedDateStr.value = day.date
}
</script>

<template>
    <nue-div vertical class="nue-calendar-monthly">
        <!-- Month Navigation -->
        <nue-div align="center" class="cal-header" gap="8px">
            <nue-div align="center" gap="2px">
                <button class="cal-nav-btn" @click="prevMonth">
                    <nue-icon name="arrow-left-s" size="18px" />
                </button>
                <nue-text tag="h2" size="var(--nue-text-df)" :weight="600" class="cal-title">
                    {{ year }} 年 {{ month }} 月
                </nue-text>
                <button class="cal-nav-btn" @click="nextMonth">
                    <nue-icon name="arrow-right-s" size="18px" />
                </button>
            </nue-div>
            <nue-button theme="ghost,small" @click="goToToday">今天</nue-button>
        </nue-div>
        <!-- Weekday Headers -->
        <nue-div class="cal-weekdays" gap="0">
            <div v-for="day in weekdays" :key="day" class="cal-weekday">{{ day }}</div>
        </nue-div>
        <!-- Date Grid -->
        <div class="cal-grid">
            <div
                v-for="(day, idx) in days"
                :key="idx"
                class="cal-cell"
                :class="{
                    'cal-cell--outside': !day.isCurrentMonth,
                    'cal-cell--today': day.isToday,
                    'cal-cell--selected': day.isSelected,
                    'cal-cell--weekend': day.isWeekend
                }"
                @click="selectDate(day)"
            >
                <span class="cal-date">{{ day.day }}</span>
                <div v-if="day.hasTasks" class="cal-dots">
                    <span
                        v-for="(dot, di) in day.dots"
                        :key="di"
                        class="cal-dot"
                        :style="{ background: dot.color }"
                    />
                </div>
            </div>
        </div>
    </nue-div>
</template>

<style scoped>
/* ── Shadcn/UI 黑白灰设计系统 ── */
.nue-calendar-monthly {
    --cal-bg: var(--nue-primary-color-0);
    --cal-fg: var(--nue-primary-text-color);
    --cal-muted: var(--nue-primary-color-100);
    --cal-muted-fg: color-mix(
        in srgb,
        var(--nue-primary-text-color) 45%,
        var(--nue-primary-color-0)
    );
    --cal-border: var(--nue-border-color);
    --cal-hover: var(--nue-primary-color-50);
    --cal-selected-bg: var(--nue-primary-text-color);
    --cal-selected-fg: var(--nue-primary-color-0);
    --cal-today-ring: var(--nue-primary-text-color);
    --cal-dot-default: var(--nue-primary-color-600);
    --cal-dot-accent: var(--nue-primary-color-400);

    height: 100%;
    gap: 0;
    padding: 1.5rem 1.75rem;
    background: var(--cal-bg);
}

/* ── Header ── */
.cal-header {
    margin-bottom: 1.5rem;
    user-select: none;
}

.cal-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--cal-fg);
    cursor: pointer;
    transition:
        background 60ms,
        border-color 60ms;
}
.cal-nav-btn:hover {
    background: var(--cal-muted);
    border-color: var(--cal-border);
}
.cal-nav-btn:active {
    background: var(--cal-border);
}

.cal-title {
    min-width: 120px;
    text-align: center;
    letter-spacing: 0.02em;
}

/* ── Weekday Headers ── */
.cal-weekdays {
    display: flex;
    margin-bottom: 2px;
}
.cal-weekday {
    flex: 1;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--cal-muted-fg);
    padding: 0.375rem 0;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

/* ── Grid ── */
.cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    flex: 1;
    gap: 1px;
    background: var(--cal-border);
    border: 1px solid var(--cal-border);
    border-radius: 8px;
    overflow: hidden;
}

/* ── Cell ── */
.cal-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 6px 4px 4px;
    background: var(--cal-bg);
    cursor: pointer;
    transition: background 50ms;
    min-height: 64px;
    position: relative;
}
.cal-cell:hover {
    background: var(--cal-hover);
    z-index: 1;
}
.cal-cell:active {
    background: color-mix(in srgb, var(--cal-hover) 80%, var(--cal-border));
}

/* Today: subtle ring */
.cal-cell--today {
    box-shadow: inset 0 0 0 1.5px var(--cal-today-ring);
    z-index: 2;
}

/* Selected: black bg + white text */
.cal-cell--selected {
    background: var(--cal-selected-bg) !important;
    z-index: 3;
}
.cal-cell--selected .cal-date {
    color: var(--cal-selected-fg);
    font-weight: 600;
}
.cal-cell--selected .cal-dot {
    background: var(--cal-selected-fg) !important;
}

/* Outside month: muted */
.cal-cell--outside .cal-date {
    color: var(--cal-muted-fg);
}
.cal-cell--outside.cal-cell--selected .cal-date {
    color: var(--cal-selected-fg);
}

/* Weekend: slightly dimmed */
.cal-cell--weekend:not(.cal-cell--selected) .cal-date {
    opacity: 0.7;
}

/* ── Date Number ── */
.cal-date {
    font-size: 0.8125rem;
    font-weight: 450;
    color: var(--cal-fg);
    line-height: 1.4;
    transition: color 60ms;
}

/* ── Task Dots ── */
.cal-dots {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: auto;
    min-height: 12px;
    padding-bottom: 2px;
}
.cal-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
}
</style>