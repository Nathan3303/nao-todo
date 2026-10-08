<script lang="ts" setup>
/**
 * 筛选触发器已选名称展示（T505 · PRD §5 ④）
 * @description 已选项在筛选栏本地按「维度选项顺序」解析后传入；≤2 项全显、
 *              ≥3 项折叠为前 2 项 + `+N`；带 color 的项（标签色为用户数据）带色点。
 *              纯展示、零业务逻辑；超宽省略由父级 `.filter-trigger` 的 nue-text clamp 承担。
 */

/** 触发器展示项（id / 名称 / 可选色点） */
type FilterTriggerItem = { id: string; name: string; color?: string }

defineProps<{
    /** 维度名（清单 / 标签 / 优先级 / 状态） */
    label: string
    /** 已选项（已按维度选项顺序） */
    items: FilterTriggerItem[]
}>()

/** 折叠阈值：超过则仅显示前 N 项 + 「+剩余」 */
const FOLD_LIMIT = 2
</script>

<template>
    <span class="filter-trigger-label">
        <span class="filter-trigger-label__dim">{{ label }}</span>
        <template v-for="(item, index) in items.slice(0, FOLD_LIMIT)" :key="item.id">
            <span class="filter-trigger-label__sep">{{ index === 0 ? '：' : '、' }}</span>
            <span
                v-if="item.color"
                class="filter-trigger-label__dot"
                :style="{ background: item.color }"
                aria-hidden="true"
            />
            <span class="filter-trigger-label__name">{{ item.name }}</span>
        </template>
        <span v-if="items.length > FOLD_LIMIT" class="filter-trigger-label__more">
            {{ ` +${items.length - FOLD_LIMIT}` }}
        </span>
    </span>
</template>

<style scoped>
.filter-trigger-label {
    white-space: nowrap;
}

/* 层级（仅令牌，明暗自适应）：维度名次级、已选名称正文色 + 中等字重 */
.filter-trigger-label__dim {
    color: var(--nue-secondary-text-color);
}

.filter-trigger-label__name {
    color: var(--nue-primary-text-color);
    font-weight: 500;
}

.filter-trigger-label__sep {
    white-space: pre;
    color: var(--nue-secondary-text-color);
}

.filter-trigger-label__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: var(--nue-gap-2xs);
    vertical-align: middle;
}

.filter-trigger-label__more {
    color: var(--nue-secondary-text-color);
}
</style>