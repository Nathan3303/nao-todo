<!--
    导航链接（DEF-116 规避）：**原生 `router-link`** + 既有 `.nue-link` 主题类

    `nue-ui@1.13.0` 的 `nue-link route=` 形态会把 RouterLink 自算的 `href` 覆盖成 `undefined`
    ⇒ 键盘 Tab / 中键新标签 / 读屏链接语义失效（`nue-ui#108`）。本组件只复原「原生链接」，
    DOM 结构与主题类名与 `nue-link` 保持一致（图标 / 文本 / 追加槽 + `--actived` 激活类），
    因此外观零变化。`router-link` 走全局注册（`resolveDynamicComponent` 取，便于测试侧桩替换与无路由降级）。
-->
<template>
    <component :is="linkComponent" :to="route" :class="classes" active-class="nue-link--actived">
        <nue-icon v-if="icon" :hinting="false" :name="icon" class="nue-link__icon" />
        <nue-text v-if="$slots.default" :clamped="1" class="nue-link__content">
            <slot />
        </nue-text>
        <nue-div v-if="$slots.append" class="nue-link__append">
            <slot name="append" />
        </nue-div>
    </component>
</template>

<script setup lang="ts">
import { computed, resolveDynamicComponent } from 'vue'
import { NueDiv, NueIcon, NueText } from 'nue-ui'
import type { NaoRouterLinkProps } from './types'

defineOptions({ name: 'NaoRouterLink' })
const props = defineProps<NaoRouterLinkProps>()

/**
 * 全局注册的 `router-link`（`app.use(router)` 提供）
 * @description 模板里直写 `<router-link>` 在**未注册**时会被 Vue 当作「组件自引用」兜底
 *              ⇒ 无限递归（单测环境即如此，2026-10-31 实测 `RangeError`）。
 *              `resolveDynamicComponent` 不做自引用兜底 ⇒ 未注册时退化为同名原生元素（安全降级）。
 */
const linkComponent = resolveDynamicComponent('router-link')

// 与 `nue-link` 的 theme 结果同值：route / route-icon / route-<size>
const classes = computed(() => [
    'nue-link',
    'nue-link--route',
    props.iconLink ? 'nue-link--route-icon' : '',
    props.size ? `nue-link--route-${props.size}` : ''
])
</script>

<style scoped>
/* 键盘焦点环（与认证互链同口径）：链接可获得焦点后必须可见 */
.nue-link:focus-visible {
    outline: 2px solid var(--nue-primary-color-600);
    outline-offset: 2px;
}
</style>