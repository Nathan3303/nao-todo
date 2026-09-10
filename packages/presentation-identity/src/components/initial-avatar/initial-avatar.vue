<script setup lang="ts">
/**
 * 离线身份头像（SHELL-03 D2=B'，首字母规则唯一来源）
 * @description 复用 `NueAvatar` 的 `default` slot（两版行为等价：`src && !imgError → <img>`；
 *              否则有 default slot → 插槽；否则 `icon`）⇒ 无头像 URL 或图片 onerror（离线必然）
 *              自动落「首字母 + 色块」；无昵称 / 非字母数字 ⇒ **不提供** default slot，
 *              由库内 `icon="user"` 回落（C-16 末条）。不自建头像盒子（C-20）。
 *              色块 = **确定性哈希 → 主题色阶令牌**（无硬编码色值；前景取色阶极值端，双主题对比一致）。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */
import { computed } from 'vue'
import type { UserInitialAvatarProps } from './types.js'

defineOptions({ name: 'UserInitialAvatar' })

const props = withDefaults(defineProps<UserInitialAvatarProps>(), {
    nickname: '',
    src: '',
    size: '2.5rem',
    label: ''
})

/** 色块色阶步（主题令牌；配 `--nue-primary-color-1000` 前景在浅/深主题下均可读） */
const BLOCK_STEPS = [400, 500, 600] as const

/** 首字母：取首个 Unicode 码点（避免代理对截断）；emoji/空白/符号 ⇒ 空 ⇒ 回落通用图标 */
const initial = computed(() => {
    const first = [...(props.nickname ?? '').trim()][0] ?? ''
    return /^[\p{L}\p{N}]$/u.test(first) ? first.toLocaleUpperCase() : ''
})

/** 确定性色块（同一昵称恒定同色；不随机、不硬编码色值） */
const blockStyle = computed(() => {
    let hash = 0
    for (const ch of props.nickname ?? '') hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 997
    const step = BLOCK_STEPS[hash % BLOCK_STEPS.length]
    return { '--initial-avatar-bg': `var(--nue-primary-color-${step})` }
})
</script>

<template>
    <!-- 有首字母：default slot 承接（src 为空或图片 onerror 时由库自动落此分支） -->
    <nue-avatar
        v-if="initial"
        class="initial-avatar"
        :style="blockStyle"
        :src="src"
        :size="size"
        :alt="nickname || undefined"
        :title="label || undefined"
        :role="label ? 'img' : undefined"
        :aria-label="label || undefined"
    >
        <span class="initial-avatar__text">{{ initial }}</span>
    </nue-avatar>
    <!-- 无昵称/非字母数字：不提供 default slot ⇒ 库内 icon="user" 回落（C-16 末条） -->
    <nue-avatar
        v-else
        :size="size"
        icon="user"
        :title="label || undefined"
        :role="label ? 'img' : undefined"
        :aria-label="label || undefined"
    />
</template>

<style scoped>
.initial-avatar {
    /* 色块：确定性哈希 → 主题色阶令牌 */
    background-color: var(--initial-avatar-bg);
    /* 前景：色阶极值端（浅色主题取最深、深色主题取最浅），保证双主题对比一致 */
    color: var(--nue-primary-color-1000);
}

.initial-avatar__text {
    font-weight: 600;
    line-height: 1;
}
</style>