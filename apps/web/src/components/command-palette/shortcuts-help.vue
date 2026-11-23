<script setup lang="ts">
/**
 * 快捷键帮助（T766 / Issue #371）
 * @description `?` 打开；内容**全部由命令注册表派生**（`registry.getAll()` 经 `useShortcutsHelp`），
 *              只列**真的有键位/手势**的命令 ⇒ 占位命令与不可达命令（已删的 `app.modal.close`）不出现，
 *              ⛔ 本组件不维护第二份快捷键清单（新增注册项即自动出现在帮助里）。
 *              按 `group` 分组（组顺序 = 注册顺序；组内顺序 = 注册顺序）。
 */
import { nextTick, ref, watch } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { useShortcutsHelp } from './use-shortcuts-help'
import { shortcutsHelpOpen } from './state'

defineOptions({ name: 'ShortcutsHelp' })

const { groups, isEmpty, refresh } = useShortcutsHelp()

const bodyRef = ref<HTMLElement | null>(null)

// 每次打开取一次注册表快照（作用域命令随宿主挂载/卸载进出注册表）
watch(shortcutsHelpOpen, (isOpen) => {
    if (isOpen) refresh()
})

/** 无输入框可聚焦 ⇒ 落焦到对话框容器（保证 Esc 与读屏顺序从面板头部开始） */
const onAfterOpen = (): void => {
    void nextTick(() => bodyRef.value?.focus())
}
</script>

<template>
    <nue-dialog
        v-model="shortcutsHelpOpen"
        theme="shortcuts-help"
        :title="t('commands.help.title')"
        @after-open="onAfterOpen"
    >
        <div
            ref="bodyRef"
            class="sh"
            role="dialog"
            aria-modal="true"
            :aria-label="t('commands.help.title')"
            tabindex="-1"
        >
            <p class="sh__intro">{{ t('commands.help.intro') }}</p>
            <loading-error
                v-if="isEmpty"
                class="sh__empty"
                :loading="false"
                :error="false"
                :empty="true"
                :empty-message="t('commands.help.empty')"
                :empty-image-src="assetUrl('/images/notaskhere.webp')"
                empty-image-size="5rem"
            />
            <div v-else class="sh__groups">
                <section
                    v-for="group in groups"
                    :key="group.name"
                    class="sh__group"
                    :aria-label="group.name"
                >
                    <h3 class="sh__group-name">{{ group.name }}</h3>
                    <dl class="sh__rows">
                        <div v-for="row in group.rows" :key="row.id" class="sh__row">
                            <dt class="sh__row-label">{{ row.label }}</dt>
                            <dd class="sh__row-keys">
                                <kbd class="sh__keys">{{ row.hint }}</kbd>
                            </dd>
                        </div>
                    </dl>
                </section>
            </div>
        </div>
    </nue-dialog>
</template>

<style>
/* NueDialog 传送至 body 弹层池 ⇒ 宿主级样式需非 scoped（同 conflict-dialog 口径） */
.nue-dialog.nue-dialog--shortcuts-help {
    width: min(560px, 92vw);
    min-width: min(360px, 92vw);
    box-sizing: border-box;
}

.nue-dialog.nue-dialog--shortcuts-help > .nue-dialog__main {
    min-height: 0;
}

.nue-dialog.nue-dialog--shortcuts-help .nue-dialog__content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.sh {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    min-height: 0;
    max-height: min(480px, 66vh);
    overflow-y: auto;
    outline: none;
}

.sh__intro {
    margin: 0;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
}

.sh__groups {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-md);
}

.sh__group-name {
    margin: 0 0 var(--nue-gap-2xs);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
    font-weight: 400;
}

.sh__rows {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-2xs);
    margin: 0;
}

/* 一行一条：左名称、右键位（无表头 / 无网格线，C 端卡片式留白） */
.sh__row {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-sm);
    min-height: var(--nue-box-size-md);
    padding: var(--nue-padding-2xs) var(--nue-gap-xs);
    border-radius: var(--nue-radius-sm);
}

.sh__row-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-df);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sh__row-keys {
    flex: none;
    margin: 0;
}

.sh__keys {
    padding: 0 var(--nue-gap-2xs);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-radius-sm);
    color: var(--nue-secondary-text-color);
    font-family: inherit;
    font-size: var(--nue-text-2xs);
    white-space: nowrap;
}

@media (max-width: 899.98px) {
    .nue-dialog.nue-dialog--shortcuts-help {
        width: 94vw;
        min-width: 0;
    }
}
</style>