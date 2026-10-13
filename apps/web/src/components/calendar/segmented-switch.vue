<script setup lang="ts">
import { computed } from 'vue'

/**
 * 通用「分段切换」组件（T512）—— 滑块式多选一（单一来源件）
 * @description
 *  - **纯展示件**：N 段等分 + 滑块指示器（整段平移），当前值 + 点击上抛由调用方注入；
 *  - 选中/hover 态、`prefers-reduced-motion` 降级均在件内定义一处；
 *  - 可访问性：`role="group"` + `aria-label`；每段 `aria-pressed`；指示器装饰性 `aria-hidden`。
 *  两处调用（"日/月/周" 视图切换 / "周起始"）只允许两轴不同：**段数** 与 **宽度策略**（fill）。
 */
defineOptions({ name: 'CalendarSegmentedSwitch' })

const props = withDefaults(
    defineProps<{
        /** 段定义（N ≥ 1；等分宽） */
        items: readonly { label: string; value: string; testId?: string; title?: string }[]
        /** 当前选中值（单一真源由调用方给出；未命中时滑块回 0） */
        modelValue: string
        /** 组 aria-label（调用方本地化文案） */
        ariaLabel?: string
        /** 宽度策略：铺满容器（100%）vs 宽度自适应（inline-flex） */
        fill?: boolean
        /** 滑块指示器测试定位 id */
        thumbTestId?: string
    }>(),
    { fill: true, thumbTestId: 'segmented-thumb' }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// @computed 滑块指示器 N 等分宽（防 0 段除零）
const thumbWidth = computed(() => `calc(100% / ${Math.max(props.items.length, 1)})`)
// @computed 滑块平移：当前选中段序号 × 100%（month/week/day → 0%/100%/200%）；无匹配时回 0
const thumbIndex = computed(() => {
    const index = props.items.findIndex((item) => item.value === props.modelValue)
    return index < 0 ? 0 : index
})

// @method 点击段 → 上抛选中值（幂等/切换语义由调用方决定）
const select = (value: string): void => emit('update:modelValue', value)
</script>

<template>
    <nue-button-group
        class="segmented-toggle"
        :class="{ 'is-fill': fill }"
        role="group"
        :aria-label="ariaLabel"
    >
        <!-- 滑块指示器（随选中段整段平移；装饰性） -->
        <span
            class="segmented-thumb"
            :data-testid="thumbTestId"
            aria-hidden="true"
            :style="{ width: thumbWidth, transform: `translateX(${thumbIndex * 100}%)` }"
        ></span>
        <nue-button
            v-for="item in items"
            :key="item.value"
            theme="small,ghost"
            class="segmented-btn"
            :class="{ 'is-active': item.value === modelValue }"
            :data-testid="item.testId"
            :title="item.title"
            :aria-pressed="item.value === modelValue"
            @click="select(item.value)"
        >
            {{ item.label }}
        </nue-button>
    </nue-button-group>
</template>

<style scoped>
/* 分段切换（T512 单一来源件）：滑块指示器 + 等分段；两处调用只许段数与宽度策略不同。
   T448 根因：调用方（日历侧边栏）在日历令牌组（`.nue-calendar-host`）之外 ⇒ 禁引 `--cal-*`
   （未定义会全量失效），槽底/指示器/字色一律用既有 `nue-*` token。
   槽底 = 主文字色 8% 混合页面底色；指示器 = 页面底色浮起（内描边 16% 混合）；
   选中字 = 主文字色加粗；未选中字 = 次要文字色。 */
.segmented-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0;
    /* 槽底色（与页面底区分） */
    background: color-mix(in srgb, var(--nue-primary-text-color) 8%, var(--nue-primary-color-0));
    border-radius: var(--nue-primary-radius);
    box-shadow: none;
    overflow: hidden;
}

/* 铺满容器（日/月/周 视图切换，侧栏顶部） */
.segmented-toggle.is-fill {
    display: flex;
    width: 100%;
}

/* 滑块指示器：N 等分宽（inline 计算）+ transform 平移；尊重 prefers-reduced-motion */
.segmented-thumb {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    border-radius: var(--nue-primary-radius);
    /* 背离槽底的“浮起”选中块（页面底色） */
    background: var(--nue-primary-color-0);
    box-shadow: inset 0 0 0 1px
        color-mix(in srgb, var(--nue-primary-text-color) 16%, var(--nue-primary-color-0));
    transition: transform 180ms ease;
    pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
    .segmented-thumb {
        transition: none;
    }
}

/* 按钮浮于指示器之上：均分宽、透明底；选中态由指示器 + 字色/字重承担 */
.segmented-toggle > .segmented-btn {
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
.segmented-toggle > .segmented-btn:not(.is-active):hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 6%, transparent);
    color: var(--nue-primary-text-color);
}
.segmented-toggle > .segmented-btn.is-active,
.segmented-toggle > .segmented-btn.is-active:hover {
    background: transparent;
    color: var(--nue-primary-text-color);
    font-weight: 600;
}
</style>