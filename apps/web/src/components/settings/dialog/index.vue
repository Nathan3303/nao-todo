<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, provide, ref } from 'vue'
import { useAuthUseCase, useUserUseCase } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { t, type LocaleKey } from '@nao-todo/shared'
import { SettingsProfileUpdater } from '../profile-updater'
import { SettingsPasswordUpdater } from '../password-updater'
import { SettingsAppSetter } from '../app-setter'
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import { bindSettingsDialogHost, open, unbindSettingsDialogHost } from './state'

/**
 * SHELL-01 设置对话框（桌面端）
 * @description 个人资料/修改密码/应用设置三区在对话框内切换，复用原 settings 页三组件
 *              （不重写表单：保存/校验/注销二次确认语义与原页面等价）；Esc 关闭（NueDialog
 *              原生，v-model 写回 state.open，焦点由宿主侧栏归还齿轮按钮）。
 *              呈现位 = 主侧栏底部齿轮按钮。
 */

defineOptions({ name: 'SettingsDialog' })

type SettingsSectionKey = 'profile' | 'password' | 'app'

const sections = [
    {
        key: 'profile' as const,
        icon: 'user',
        titleKey: 'nav.settingsProfile' as LocaleKey,
        component: SettingsProfileUpdater
    },
    {
        key: 'password' as const,
        icon: 'lock',
        titleKey: 'nav.settingsPassword' as LocaleKey,
        component: SettingsPasswordUpdater
    },
    {
        key: 'app' as const,
        icon: 'setting',
        titleKey: 'nav.settingsApp' as LocaleKey,
        component: SettingsAppSetter
    }
]

// @state 当前区（默认个人资料；切换即卸载重建，与原路由页面切换同语义）
const activeKey = ref<SettingsSectionKey>('profile')
const activeSection = computed(() => sections.find((s) => s.key === activeKey.value)!)

// @contexts（仅 UI/服务；业务依赖下方本地组装——与原 settings-view 同构）
const { appSubscriber, appDialogManager, isDisplayAside, isUseFloatAside, switchDisplayAside } =
    inject(INDEX_VIEW_CONTEXT_KEY)!

// @stores/@usecases
const userStore = useUserStore()
const userUseCase = useUserUseCase(userStore)
const authUseCase = useAuthUseCase(userStore)

// @provide Settings 上下文（三区组件注入依赖不变）
provide(SETTINGS_VIEW_CONTEXT_KEY, {
    authUseCase,
    userUseCase,
    subscriber: appSubscriber,
    dialogManager: appDialogManager,
    isDisplayAside,
    isUseFloatAside,
    switchDisplayAside
})

// @host 置位（桌面宿主在屏才允许命令/齿轮开启；卸载复位防残留）
onMounted(bindSettingsDialogHost)
onUnmounted(unbindSettingsDialogHost)
</script>

<template>
    <nue-dialog v-model="open" theme="settings" :title="t('nav.settings')">
        <!-- 三区切换（原 settings 页面级左栏导航收敛为对话框内分区条） -->
        <div class="sd-tabs" role="tablist" aria-label="设置分区">
            <button
                v-for="section in sections"
                :key="section.key"
                type="button"
                class="sd-tab"
                :class="{ 'is-active': section.key === activeKey }"
                role="tab"
                :aria-selected="section.key === activeKey"
                @click="activeKey = section.key"
            >
                <nue-icon :name="section.icon" />
                <span>{{ t(section.titleKey) }}</span>
            </button>
        </div>
        <component :is="activeSection.component" :key="activeKey" />
    </nue-dialog>
</template>

<style>
/* 对话框宿主级样式（NueDialog 传送至 body 弹层池，需非 scoped） */
.nue-dialog--settings {
    width: min(46rem, calc(100vw - 2rem));
    max-height: calc(100vh - 4rem);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.nue-dialog--settings > .nue-dialog__main {
    flex: 1;
    min-height: 0;
    display: flex;
}

.nue-dialog--settings .nue-dialog__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
}

/* 三区组件自身的页面级页头（原路由页「菜单/标题」行）在对话框内由分区条替代，隐藏之 */
.nue-dialog--settings .nue-dialog__content .nue-header {
    display: none;
}

/* 分区条 */
.sd-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 0 0.75rem;
    border-bottom: 1px solid var(--nue-border-color);
    margin-bottom: 0.75rem;
    flex: none;
}

.sd-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: var(--nue-primary-radius);
    border: 1px solid transparent;
    background: transparent;
    color: var(--nue-primary-color-600);
    font-size: var(--nue-text-sm);
    line-height: 1.25;
    cursor: pointer;
}

.sd-tab:hover {
    background: var(--nue-primary-color-200);
}

.sd-tab:focus-visible {
    outline: 1px solid var(--nue-primary-color-600);
    outline-offset: 1px;
}

/* 激活态 = NueUI primary 同款色对（由 color-900 按 dark-switch 偏移 + color-100 前景，双主题恒定可见） */
.sd-tab.is-active {
    background: hsl(from var(--nue-primary-color-900) h s calc(l - var(--nue-dark-switch) * 10));
    border-color: hsl(from var(--nue-primary-color-900) h s calc(l - var(--nue-dark-switch) * 10));
    color: var(--nue-primary-color-100);
    font-weight: 600;
}
</style>