<script setup lang="ts">
import { computed } from 'vue'
import { t, type LocaleKey } from '@nao-todo/shared/locales'
import type { CalendarViewMode } from '@/components/calendar/use-calendar-host'
import {
    CALENDAR_VIEW_NAMES,
    isCalendarViewName,
    type CalendarViewName
} from '@/views/index/calendar/view-routes'

/**
 * 日历子视图切换器（T445 ①）—— 唯一实现，两态复用（**纯展示件**：当前态 + 切换回调由调用方注入）
 * @description
 *  - `segmented`（默认）：三格分段按钮，落在日历侧边栏顶部（`CalendarAside`，回调 = 路由切换）；
 *  - `compact`：仅「当前视图名 + 下拉三项」，落在各视图内容区头部，**侧栏隐藏时的兜底入口**
 *    （回调 = 该视图上下文既有的 `onGo*`，应用内即路由切换，standalone 自足态亦可切换）。
 *  切换语义（路由真源 / 幂等短路 / taskId·query 透传）由调用方的 `onSwitch` 决定，本组件不直接读路由。
 */
defineOptions({ name: 'CalendarViewSwitch' })

const props = withDefaults(
    defineProps<{
        variant?: 'segmented' | 'compact'
        /** 当前视图态（单一真源由调用方给出） */
        current: CalendarViewMode
        /** 切换回调（子路由名） */
        onSwitch: (name: CalendarViewName) => void
    }>(),
    { variant: 'segmented' }
)

const ITEMS = [
    { name: 'calendar-monthly', labelKey: 'calendar.view.month' },
    { name: 'calendar-weekly', labelKey: 'calendar.view.week' },
    { name: 'calendar-day', labelKey: 'calendar.view.day' }
] as const satisfies readonly { name: CalendarViewName; labelKey: LocaleKey }[]

// @computed 当前视图名（紧凑态触发器文案）
const currentLabelKey = computed<LocaleKey>(() => {
    if (props.current === 'week') return 'calendar.view.week'
    if (props.current === 'day') return 'calendar.view.day'
    return 'calendar.view.month'
})
const isActive = (name: CalendarViewName): boolean => CALENDAR_VIEW_NAMES[name] === props.current
// @computed 滑块 Tab 指示器位置（当前视图序号；无匹配时回 0）
const thumbIndex = computed(() => {
    const index = ITEMS.findIndex((item) => isActive(item.name))
    return index < 0 ? 0 : index
})

// @method 切换（透传给调用方；已是当前视图亦由调用方幂等处理）
const switchTo = (name: CalendarViewName): void => props.onSwitch(name)

// @method 紧凑态下拉 execute：data-executeid = 子路由名
const onExecute = (id: string): void => {
    if (isCalendarViewName(id)) switchTo(id)
}
</script>

<template>
    <!-- 分段态：侧边栏顶部 -->
    <nue-button-group
        v-if="variant === 'segmented'"
        class="cal-view-toggle"
        role="group"
        :aria-label="t('calendar.viewSwitch')"
    >
        <!-- 滑块指示器（随当前视图平移；装饰性） -->
        <span
            class="cal-view-thumb"
            data-testid="calendar-view-thumb"
            aria-hidden="true"
            :style="{ transform: `translateX(${thumbIndex * 100}%)` }"
        ></span>
        <nue-button
            v-for="item in ITEMS"
            :key="item.name"
            theme="small,ghost"
            class="cal-view-btn"
            :class="{ 'is-active': isActive(item.name) }"
            :data-testid="`calendar-view-${CALENDAR_VIEW_NAMES[item.name]}`"
            :title="t(item.labelKey)"
            :aria-pressed="isActive(item.name)"
            @click="switchTo(item.name)"
        >
            {{ t(item.labelKey) }}
        </nue-button>
    </nue-button-group>

    <!-- 紧凑态：侧栏隐藏时的内容区头部兜底（当前视图名 + 下拉三项） -->
    <nue-dropdown
        v-else
        placement="bottom-start"
        size="small"
        group="calendar-view-switch"
        close-when-executed
        @execute="onExecute"
    >
        <template #trigger="{ trigger }">
            <nue-button
                data-testid="calendar-view-switch-compact"
                theme="ghost,small"
                :title="t('calendar.viewSwitch')"
                @click="trigger"
            >
                {{ t(currentLabelKey) }}
            </nue-button>
        </template>
        <div class="vswitch" role="menu">
            <button
                v-for="item in ITEMS"
                :key="item.name"
                type="button"
                class="vswitch__item"
                role="menuitem"
                :class="{ 'is-on': isActive(item.name) }"
                :data-executeid="item.name"
            >
                {{ t(item.labelKey) }}
            </button>
        </div>
    </nue-dropdown>
</template>

<style scoped>
/* 月/周/日视图切换（T445 ① 落侧边栏顶部；T447 改滑块 Tab：指示器随当前视图平移）。
   T448 根因修复：侧栏在日历令牌组（`.nue-calendar-host` 等）之外 ⇒ `--cal-*` 未定义 ⇒ 改用既有 `nue-*` token。
   槽底 = 主文字色 8% 混合页面底色；容器边 = 55% 混合；指示器 = 页面底色；选中字 = 主文字色；未选中字 = 次要文字色。 */
.cal-view-toggle {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0;
    width: 100%;
    /* 槽底色（与页面底区分） */
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
    border-radius: var(--nue-primary-radius);
    box-shadow: none;
    overflow: hidden;
}

/* 滑块指示器：三等分宽，靠 transform 平移；尊重 prefers-reduced-motion */
.cal-view-thumb {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% / 3);
    border-radius: var(--nue-primary-radius);
    /* 背离槽底的“浮起”选中块（页面底色） */
    background: var(--nue-primary-color-0);
    box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--nue-primary-text-color) 16%, var(--nue-primary-color-0));
    transition: transform 180ms ease;
    pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
    .cal-view-thumb {
        transition: none;
    }
}

/* 按钮浮于指示器之上：均分宽、透明底；选中态由指示器 + 字色/字重承担 */
.cal-view-toggle > .cal-view-btn {
    position: relative;
    z-index: 1;
    flex: 1;
    margin: 0;
    border-radius: 0 !important;
    background: transparent;
    box-shadow: none;
    color: var(--nue-secondary-text-color);
    justify-content: center;
    align-items: center;
}
.cal-view-toggle > .cal-view-btn:not(.is-active):hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 6%, transparent);
    color: var(--nue-primary-text-color);
}
.cal-view-toggle > .cal-view-btn.is-active,
.cal-view-toggle > .cal-view-btn.is-active:hover {
    background: transparent;
    color: var(--nue-primary-text-color);
    font-weight: 600;
}

/* 模式菜单内容（外层卡片/定位由 NueDropdown 承担；样式与改期菜单同源，不另起体系） */
.vswitch {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 8rem;
}

.vswitch__item {
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

.vswitch__item:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
}

.vswitch__item.is-on {
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
}
</style>