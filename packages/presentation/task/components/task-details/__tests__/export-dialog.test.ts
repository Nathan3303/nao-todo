// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import TaskExportDialog from '../export-dialog.vue'

/**
 * 导出对话框（可编辑 + 还原）组件断言（T33 / AC1–AC4）
 * @description 契约（PRD §5.4）：
 *  - 内容区由只读 `<pre>` 改为可编辑文本域（`NueTextarea`），本地草稿 `draft`；
 *  - `copy` 事件携带**编辑后**文本（footer 据此写入剪贴板）；
 *  - 提供「还原」按钮（i18n 键 `task.details.export.restore`），恢复为 props.markdown；
 *  - 编辑期间 props.markdown 变化**不覆盖**草稿；仅在 false→true 打开时同步。
 *  组件以轻量 stub 隔离 nue-ui，聚焦对话框自身状态机。
 */

// --- nue-ui stubs（render 函数，避免运行时模板编译依赖） ---

const DialogStub = defineComponent({
    name: 'NueDialog',
    props: { modelValue: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    setup(props, { slots }) {
        return () =>
            props.modelValue
                ? h('div', { class: 'stub-dialog' }, [slots.content?.(), slots.footer?.()])
                : null
    }
})

const DivStub = defineComponent({
    name: 'NueDiv',
    setup(_, { slots }) {
        return () => h('div', { class: 'stub-div' }, slots.default?.())
    }
})

const ButtonStub = defineComponent({
    name: 'NueButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
        return () =>
            h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
})

const TextareaStub = defineComponent({
    name: 'NueTextarea',
    props: { modelValue: { type: String, default: '' } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('textarea', {
                class: 'stub-textarea',
                value: props.modelValue,
                onInput: (event: Event) =>
                    emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
            })
    }
})

const stubs = {
    NueDialog: DialogStub,
    'nue-dialog': DialogStub,
    NueDiv: DivStub,
    'nue-div': DivStub,
    NueButton: ButtonStub,
    'nue-button': ButtonStub,
    NueTextarea: TextareaStub,
    'nue-textarea': TextareaStub
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

const mountDialog = (props: { modelValue: boolean; markdown: string }): VueWrapper => {
    wrapper = mount(TaskExportDialog, {
        attachTo: document.body,
        props,
        global: { stubs }
    })
    return wrapper
}

const textareaValue = (w: VueWrapper): string =>
    (w.find('textarea').element as HTMLTextAreaElement).value

const findButton = (w: VueWrapper, pattern: RegExp): DOMWrapper<Element> => {
    const button = w.findAll('button').find((item) => pattern.test(item.text()))
    if (!button) throw new Error(`未找到匹配 ${pattern} 的按钮`)
    return button
}

describe('TaskExportDialog - 可编辑内容（AC1）', () => {
    it('内容区为可编辑文本域并回显生成文本（不再是只读 <pre>）', () => {
        const md = ['# 任务', '', '## 子任务', '', '- [ ] 子任务'].join('\n')
        const w = mountDialog({ modelValue: true, markdown: md })

        expect(w.find('pre').exists()).toBe(false)
        expect(w.find('textarea').exists()).toBe(true)
        expect(textareaValue(w)).toBe(md)
    })

    it('modelValue=false 时不渲染对话框内容', () => {
        const w = mountDialog({ modelValue: false, markdown: '# 任务' })
        expect(w.find('textarea').exists()).toBe(false)
    })
})

describe('TaskExportDialog - 复制编辑后文本（AC2）', () => {
    it('未编辑时复制 ⇒ copy 事件携带原始生成文本', async () => {
        const w = mountDialog({ modelValue: true, markdown: '# 原始文本' })

        await findButton(w, /复制|Copy/).trigger('click')

        expect(w.emitted('copy')?.at(-1)).toEqual(['# 原始文本'])
    })

    it('编辑后复制 ⇒ copy 事件携带编辑后文本', async () => {
        const w = mountDialog({ modelValue: true, markdown: '# 原始文本' })

        await w.find('textarea').setValue('# 编辑后的文本\n- [ ] 新增项')
        await findButton(w, /复制|Copy/).trigger('click')

        expect(w.emitted('copy')?.at(-1)).toEqual(['# 编辑后的文本\n- [ ] 新增项'])
    })
})

describe('TaskExportDialog - 还原生成文本（AC3）', () => {
    it('编辑后点「还原」⇒ 文本恢复为最近一次生成内容，复制亦回到原文', async () => {
        const w = mountDialog({ modelValue: true, markdown: '# 生成文本' })

        await w.find('textarea').setValue('# 被我改坏了')
        expect(textareaValue(w)).toBe('# 被我改坏了')

        await findButton(w, /还原|恢复|Restore|Reset/i).trigger('click')

        expect(textareaValue(w)).toBe('# 生成文本')
        await findButton(w, /复制|Copy/).trigger('click')
        expect(w.emitted('copy')?.at(-1)).toEqual(['# 生成文本'])
    })
})

describe('TaskExportDialog - 草稿不被覆盖（AC4）', () => {
    it('编辑期间 props.markdown 变化不覆盖草稿', async () => {
        const w = mountDialog({ modelValue: true, markdown: '# 首次生成' })

        await w.find('textarea').setValue('# 用户编辑中')
        await w.setProps({ markdown: '# 生成器重新生成' })

        expect(textareaValue(w)).toBe('# 用户编辑中')
    })

    it('关→开（false→true）时同步为最新生成文本', async () => {
        const w = mountDialog({ modelValue: true, markdown: '# 首次生成' })
        await w.find('textarea').setValue('# 旧草稿')

        await w.setProps({ modelValue: false })
        await w.setProps({ modelValue: true, markdown: '# 再次生成' })

        expect(textareaValue(w)).toBe('# 再次生成')
    })
})