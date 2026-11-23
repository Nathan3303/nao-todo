<script setup lang="ts">
/**
 * 命令面板（T766 / Issue #371）
 * @description `Ctrl/⌘ + K` 打开；**数据源只有命令注册表**（`registry.getAll()`，经
 *              `useCommandPalette` 取快照），⛔ 此处不手写命令或快捷键清单。
 *              交互：输入即时过滤（label + description，大小写不敏感）· ↑/↓ 选择 · Enter 执行 ·
 *              Esc 关闭（`NueDialog` 原生 `onEscape`）· 执行后关闭面板。
 *              排除自身：注册在注册表里的 `app.command-palette.open` 标记 `hidden`，不在面板列出
 *              （快捷键帮助里仍然出现）。
 * @see packages/shared/commands/registry.ts（注册中心）
 * @see apps/web/src/components/sync/conflict-dialog.vue（对话框范式：after-open 聚焦 + v-model 回落）
 */
import { computed, nextTick, ref, watch } from 'vue'
import { t } from '@nao-todo/shared/locales'
import { assetUrl } from '@nao-todo/shared/utils/asset-url'
import { LoadingError } from '@nao-todo/shared/components/loading-error'
import { registry } from '@/commands/instance'
import { useCommandPalette } from './use-command-palette'
import { closeCommandPalette, commandPaletteOpen } from './state'

defineOptions({ name: 'CommandPalette' })

/** 列表与选项的 DOM id（`aria-controls` / `aria-activedescendant` 目标） */
const LISTBOX_ID = 'command-palette-listbox'
const optionIdOf = (index: number): string => `command-palette-option-${index}`

const {
    query,
    setQuery,
    activeIndex,
    activeId,
    groups,
    options,
    refresh,
    resetActive,
    move,
    setActive
} = useCommandPalette()

/** 搜索框组件实例（聚焦落在其内部真正的 `<input>` 上） */
const inputRef = ref<{ $el?: unknown } | null>(null)
/** 打开前焦点所在元素（关闭后归还；键盘触发的面板没有按钮可在关闭后聚焦） */
const restoreTarget = ref<HTMLElement | null>(null)

/** 组合框语义（挂在真正的 `<input>` 上；面板列表是 `listbox`，选项是 `option`） */
const inputAttrs = computed(() => ({
    role: 'combobox',
    'aria-expanded': true,
    'aria-controls': LISTBOX_ID,
    'aria-autocomplete': 'list',
    'aria-activedescendant': activeId.value === '' ? undefined : optionIdOf(activeIndex.value),
    'aria-label': t('commands.palette.placeholder'),
    autocomplete: 'off',
    spellcheck: false
}))

// 打开：取注册表快照（日历等作用域命令随宿主进出注册表）+ 复位查询与选中 + 记住归还目标
watch(commandPaletteOpen, (isOpen) => {
    if (isOpen) {
        restoreTarget.value =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        refresh()
        query.value = ''
        resetActive()
        return
    }
    // 关闭：焦点归还（Esc / 执行 / 关闭按钮三条路径都经 v-model 回落此处）
    const target = restoreTarget.value
    restoreTarget.value = null
    target?.focus()
})

/** `NueDialog` 的 `after-open` 在开启动画结束时触发（早于它 overlay 会自己抢焦点）⇒ 此处再聚焦输入框 */
const onAfterOpen = (): void => {
    void nextTick(() => {
        const root = inputRef.value?.$el
        if (root instanceof HTMLElement) root.querySelector('input')?.focus()
    })
}

/** 选中项滚入可视区（长列表方向键导航；`scrollIntoView` 在 jsdom 中不存在 ⇒ 可选调用） */
watch(activeIndex, () => {
    void nextTick(() => {
        document.getElementById(optionIdOf(activeIndex.value))?.scrollIntoView?.({
            block: 'nearest'
        })
    })
})

/** 执行命令：先关面板再执行（命令可能打开另一个对话框，避免两层叠在一起） */
const execute = (id: string): void => {
    if (id === '') return
    closeCommandPalette()
    registry.execute(id)
}

const executeActive = (): void => {
    execute(activeId.value)
}

/**
 * 输入框键盘导航
 * @description ↑/↓ 循环选择、Enter 执行、Home/End 跳首尾；Esc 交给 `NueDialog` 的 overlay 处理
 *              （与其它对话框同源，不在此处重复实现关闭逻辑）。
 */
const onKeydown = (event: KeyboardEvent): void => {
    switch (event.key) {
        case 'ArrowDown': {
            event.preventDefault()
            move(1)
            break
        }
        case 'ArrowUp': {
            event.preventDefault()
            move(-1)
            break
        }
        case 'Home': {
            event.preventDefault()
            setActive(0)
            break
        }
        case 'End': {
            event.preventDefault()
            setActive(Math.max(0, options.value.length - 1))
            break
        }
        case 'Enter': {
            event.preventDefault()
            executeActive()
            break
        }
        default: {
            break
        }
    }
}
</script>

<template>
    <nue-dialog
        v-model="commandPaletteOpen"
        theme="command-palette"
        :title="t('commands.palette.title')"
        @after-open="onAfterOpen"
    >
        <div class="cp" role="dialog" aria-modal="true" :aria-label="t('commands.palette.title')">
            <nue-input
                ref="inputRef"
                class="cp__input"
                icon="search"
                clearable
                :model-value="query"
                :placeholder="t('commands.palette.placeholder')"
                :input-attrs="inputAttrs"
                @update:model-value="setQuery"
                @keydown="onKeydown"
            />
            <loading-error
                v-if="options.length === 0"
                class="cp__empty"
                :loading="false"
                :error="false"
                :empty="true"
                :empty-message="t('commands.palette.empty')"
                :empty-image-src="assetUrl('/images/notaskhere.webp')"
                empty-image-size="5rem"
            />
            <div
                v-else
                :id="LISTBOX_ID"
                class="cp__list"
                role="listbox"
                :aria-label="t('commands.palette.list')"
            >
                <div
                    v-for="group in groups"
                    :key="group.name"
                    class="cp__group"
                    role="group"
                    :aria-label="group.name"
                >
                    <p class="cp__group-name" aria-hidden="true">{{ group.name }}</p>
                    <ul class="cp__options" role="none">
                        <li
                            v-for="option in group.options"
                            :id="optionIdOf(option.index)"
                            :key="option.id"
                            class="cp__option"
                            :class="{ 'is-active': option.index === activeIndex }"
                            role="option"
                            :aria-selected="option.index === activeIndex"
                            @mouseenter="setActive(option.index)"
                            @click="execute(option.id)"
                        >
                            <nue-icon
                                v-if="option.icon"
                                class="cp__option-icon"
                                :name="option.icon"
                                size="1rem"
                            />
                            <span class="cp__option-text">
                                <span class="cp__option-label">{{ option.label }}</span>
                                <span v-if="option.description" class="cp__option-desc">
                                    {{ option.description }}
                                </span>
                            </span>
                            <kbd v-if="option.hint" class="cp__option-hint">{{ option.hint }}</kbd>
                        </li>
                    </ul>
                </div>
            </div>
            <p class="cp__footer">{{ t('commands.palette.hint') }}</p>
        </div>
    </nue-dialog>
</template>

<style>
/* NueDialog 传送至 body 弹层池 ⇒ 宿主级样式需非 scoped（同 conflict-dialog 口径） */
.nue-dialog.nue-dialog--command-palette {
    width: min(640px, 92vw);
    min-width: min(420px, 92vw);
    box-sizing: border-box;
}

.nue-dialog.nue-dialog--command-palette > .nue-dialog__main {
    min-height: 0;
}

.nue-dialog.nue-dialog--command-palette .nue-dialog__content {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.cp {
    display: flex;
    flex-direction: column;
    gap: var(--nue-gap-sm);
    min-height: 0;
    max-height: min(420px, 60vh);
    outline: none;
}

.cp__list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--nue-gap-md);
    min-height: 0;
    overflow-y: auto;
}

.cp__group-name {
    margin: 0;
    padding: 0 var(--nue-gap-xs);
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-xs);
}

.cp__options {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}

/* 列表条目点击区 ≥40px（C 端可用性：DESIGN §可用性底线） */
.cp__option {
    display: flex;
    align-items: center;
    gap: var(--nue-gap-sm);
    min-height: var(--nue-box-size-md);
    padding: var(--nue-padding-2xs) var(--nue-gap-xs);
    border-radius: var(--nue-radius-sm);
    cursor: pointer;
}

.cp__option.is-active {
    background: var(--nue-primary-color-100);
}

.cp__option-icon {
    flex: none;
    color: var(--nue-secondary-text-color);
}

.cp__option-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.cp__option-label {
    overflow: hidden;
    color: var(--nue-primary-text-color);
    font-size: var(--nue-text-df);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cp__option-desc {
    overflow: hidden;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cp__option-hint {
    flex: none;
    padding: 0 var(--nue-gap-2xs);
    border: 1px solid var(--nue-border-color);
    border-radius: var(--nue-radius-sm);
    color: var(--nue-secondary-text-color);
    font-family: inherit;
    font-size: var(--nue-text-2xs);
}

.cp__empty {
    flex: 1;
    min-height: 0;
}

.cp__footer {
    display: flex;
    justify-content: flex-end;
    margin: 0;
    color: var(--nue-secondary-text-color);
    font-size: var(--nue-text-2xs);
}

@media (max-width: 899.98px) {
    .nue-dialog.nue-dialog--command-palette {
        width: 94vw;
        min-width: 0;
    }

    .cp {
        max-height: min(360px, 55vh);
    }
}
</style>