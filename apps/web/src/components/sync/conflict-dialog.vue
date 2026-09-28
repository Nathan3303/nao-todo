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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { conflictObjectCount } from '@nao-todo/infrastructure/src/persistence-sync/conflict-journal'
import { useConflictUx } from '@/hooks'
import ConflictList from './conflict-list.vue'

defineOptions({ name: 'ConflictDialog' })

const emit = defineEmits<{ close: []; beforeClose: [] }>()

const open = defineModel<boolean>({ default: false })

const ux = useConflictUx()
const bodyRef = ref<HTMLElement | null>(null)
/**
 * 本对话框**自己的**遮罩节点（身份判定用）。每次打开刷新；关闭时**不清空** ——
 * 关闭那次 click 的 `composedPath()` 是 dispatch 快照，仍需用该引用命中。
 */
const overlayEl = ref<HTMLElement | null>(null)

/** T346：标题计数 = **对象数**（distinct `table:entityId`），与左栏行数 / badge 同口径 */
const objectCount = computed(() => conflictObjectCount(ux.items.value))

/** T347：底部「关闭」/ 标题栏 `×` 均请求父级关闭对话框（焦点归还在父级统一处理） */
const requestClose = (): void => {
    emit('close')
}

/**
 * T353 / T355：阻断**本冲突对话框**（面板 + 遮罩）内的点击到达 `window` 的下拉「点外部即关」监听。
 * @description `NueDropdown`（本面板 `transparent`）打开时在 **`window`（冒泡）** 注册 click 监听，
 *   任何 window click 都关闭面板（**无 target 判定**，nue-ui `dropdown-*.js` 的 open 处理器）；
 *   冲突对话框 `Teleport` 到 body、在 popper 之外 ⇒ 点 `×` / 底部按钮 **以及遮罩空白** 都会被
 *   误判「点外部」关掉父面板，`SyncStatusBar` 的 `@close` 随即把焦点移回轨道按钮。
 *
 *   关键时序（qa 真机定位）：**浏览器在每次事件监听回调之间有 microtask 检查点** ⇒ 关闭那次 click
 *   置 `open=false` 后，Vue 的 flush 会在该 click 冒泡到 `window` **之前**执行；故监听器必须
 *   **常驻**（组件 mount→unmount），不能在「对话框开/关」时增删。
 *   - 注册于 **`document` 冒泡阶段**（早于 `window` 冒泡）⇒ 截断后 dropdown 收不到；
 *   - **身份判定**：用本对话框**自己的** overlay 节点做 `composedPath().includes(overlayEl)`
 *     ⇒ 只对本对话框截断，**不按通用类名 .nue-dialog-overlay 无差别匹配**（避免影响其它对话框）；
 *     用 `composedPath()`（dispatch 快照）而非 `event.target.closest(...)` ⇒ 目标在关闭瞬间卸载也能命中。
 *   - 遮罩语义：NueDialog 的 overlay 只绑 `onEscape`、**无 `onClick`**（nue-ui `dialog-*.js`）
 *     ⇒ 点遮罩**不关闭**对话框 ⇒ 此处只需不冒泡（面板保持打开、焦点不动）。
 */
const stopDialogClickBubble = (event: Event): void => {
    const overlay = overlayEl.value
    if (overlay && event.composedPath().includes(overlay)) event.stopPropagation()
}

// 打开时刷新「本对话框 overlay」引用（关闭后再次打开是新节点）；关闭时**不**改写（见上）
watch(open, (isOpen) => {
    if (!isOpen) return
    void nextTick(() => {
        overlayEl.value =
            (bodyRef.value?.closest('.nue-dialog-overlay') as HTMLElement | null) ?? null
    })
})

onMounted(() => document.addEventListener('click', stopDialogClickBubble))
onBeforeUnmount(() => document.removeEventListener('click', stopDialogClickBubble))

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