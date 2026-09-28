<script setup lang="ts">
/**
 * 冲突对话框（T338）—— 入口「冲突 N」打开的模态框：左栏冲突记录 / 右栏 diff
 *
 * @description 数据面经 `useConflictUx`（DI 唯一入口，**单实例**传入列表主体，避免两套状态）；
 *              本组件只管容器与 a11y：`role="dialog"` / `aria-modal` / aria-label；
 *              Esc 关闭由 `NueDialog` 原生 `onEscape` 处理；打开后焦点入框（`after-open`）；
 *              关闭后焦点归还触发按钮由父级 `SyncStatusBar` 负责。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md §9.2
 */
import { computed, nextTick, ref } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { conflictObjectCount } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { useConflictUx } from '@/hooks'
import ConflictList from './conflict-list.vue'

defineOptions({ name: 'ConflictDialog' })

const emit = defineEmits<{ close: []; beforeClose: [] }>()

const open = defineModel<boolean>({ default: false })

const ux = useConflictUx()
const bodyRef = ref<HTMLElement | null>(null)

/** T346：标题计数 = **对象数**（distinct `table:entityId`），与左栏行数 / badge 同口径 */
const objectCount = computed(() => conflictObjectCount(ux.items.value))

/** T347：底部「关闭」/ 标题栏 `×` 均请求父级关闭对话框（焦点归还在父级统一处理） */
const requestClose = (): void => {
    emit('close')
}

const onAfterOpen = (): void => {
    void nextTick(() => bodyRef.value?.focus())
}
</script>

<template>
    <nue-dialog
        v-model="open"
        theme="conflict,large"
        @after-open="onAfterOpen"
        @before-close="emit('beforeClose')"
    >
        <!-- 对话框标题栏：名称 + 条数走 header 插槽（不拼字符串） -->
        <template #header>
            <div class="conflict-dialog__header-left">
                <nue-text class="nue-dialog__header__title">
                    {{ t('sync.conflict.title') }}
                </nue-text>
                <nue-text size="xs" class="conflict-dialog__header-count">
                    {{ t('sync.conflict', { count: objectCount }) }}
                </nue-text>
            </div>
            <nue-button
                class="nue-dialog__header__closebtn"
                theme="icon,ghost,small"
                icon="clear"
                :aria-label="t('sync.conflict.close')"
                @click="requestClose"
            />
        </template>
        <div
            ref="bodyRef"
            class="conflict-dialog__body"
            role="dialog"
            aria-modal="true"
            :aria-label="t('sync.conflict.title')"
            tabindex="-1"
        >
            <ConflictList :ux="ux" @close="requestClose" />
        </div>
    </nue-dialog>
</template>

<style>
/* NueDialog 传送至 body 弹层池 ⇒ 宿主级样式需非 scoped；两点类选择器确保覆盖基础 .nue-dialog 尺寸 */
.nue-dialog.nue-dialog--conflict {
    width: min(960px, 92vw);
    height: min(620px, 86vh);
    min-width: min(560px, 92vw);
    box-sizing: border-box;
}

.nue-dialog.nue-dialog--conflict > .nue-dialog__main {
    flex: 1;
    min-height: 0;
    display: flex;
}

.nue-dialog.nue-dialog--conflict .nue-dialog__content {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;
}

.conflict-dialog__body {
    display: flex;
    flex: 1;
    min-height: 0;
    outline: none;
}

.conflict-dialog__header-left {
    display: flex;
    align-items: baseline;
    gap: var(--nue-gap-xs);
    min-width: 0;
}

.conflict-dialog__header-count {
    color: var(--nue-secondary-text-color);
}

@media (max-width: 899.98px) {
    .nue-dialog.nue-dialog--conflict {
        width: 94vw;
        height: 90vh;
        min-width: 0;
    }

    .nue-dialog.nue-dialog--conflict .nue-dialog__content {
        overflow-y: auto;
    }
}
</style>