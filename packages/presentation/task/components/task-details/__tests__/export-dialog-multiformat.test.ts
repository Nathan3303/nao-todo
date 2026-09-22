// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import type { ExportTaskNode } from '../export-markdown'
import { generateTaskHtml } from '../export-html'
import TaskExportDialog from '../export-dialog.vue'

/**
 * TASK-22 T94 —— 导出对话框三态 + 多格式断言（PRD §5.2 / §5.4 / §6 / AC1–AC4）
 * @description 契约：
 *  - props 全部有默认值以兼容 TASK-13 旧挂载：`format='markdown'` / `status='ready'` /
 *    `json=''` / `html=''` / `errorMessage=''`；
 *  - 三态：`loading` → LoadingError loading；`error` → LoadingError error + 「重试」；
 *    `ready` → 按 `format` 渲染；
 *  - 仅 Markdown 可编辑（`NueTextarea` 草稿）且「还原」仅在 Markdown 出现；
 *  - JSON 只读 `<pre>`；HTML 只读 `iframe[sandbox=""]`，`:srcdoc` === HTML 纯函数输出；
 *  - 复制 payload：Markdown=编辑后草稿 / JSON=JSON 文本 / HTML=完整文档源码；
 *  - 顶部分段控件切换格式仅 emit `update:format`（受控），不触发取数；
 *  - 内容区 `min-height: min(60vh, 32rem)`（源码级断言，jsdom 不落 CSS）。
 *
 * ⚠️ 用例先行：`format` / `status` / `json` / `html` / `errorMessage` props、格式分段控件、
 *    iframe 预览与三态均属 T96，未落地 ⇒ 当前预期红。
 */

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

const ButtonGroupStub = defineComponent({
    name: 'NueButtonGroup',
    inheritAttrs: false,
    setup(_, { slots, attrs }) {
        return () => h('div', { ...attrs, class: 'stub-button-group' }, slots.default?.())
    }
})

const ButtonStub = defineComponent({
    name: 'NueButton',
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { slots, emit, attrs }) {
        return () =>
            h(
                'button',
                { ...attrs, type: 'button', onClick: () => emit('click') },
                slots.default?.()
            )
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

const LoadingErrorStub = defineComponent({
    name: 'LoadingError',
    props: {
        loading: { type: Boolean, default: false },
        error: { type: Boolean, default: false },
        errorMessage: { type: String, default: '' }
    },
    setup(props, { slots }) {
        return () =>
            h(
                'div',
                {
                    class: 'stub-loading-error',
                    'data-loading': String(props.loading),
                    'data-error': String(props.error)
                },
                props.error
                    ? [
                          h('span', { class: 'stub-error-message' }, props.errorMessage),
                          slots.error?.()
                      ]
                    : []
            )
    }
})

const stubs = {
    NueDialog: DialogStub,
    'nue-dialog': DialogStub,
    NueDiv: DivStub,
    'nue-div': DivStub,
    NueButtonGroup: ButtonGroupStub,
    'nue-button-group': ButtonGroupStub,
    NueButton: ButtonStub,
    'nue-button': ButtonStub,
    NueTextarea: TextareaStub,
    'nue-textarea': TextareaStub,
    LoadingError: LoadingErrorStub,
    'loading-error': LoadingErrorStub
}

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

type DialogProps = {
    modelValue?: boolean
    markdown?: string
    format?: string
    status?: string
    json?: string
    html?: string
    errorMessage?: string
}

const mountDialog = (props: DialogProps = {}): VueWrapper => {
    wrapper = mount(TaskExportDialog, {
        attachTo: document.body,
        props: { modelValue: true, markdown: '# 任务', ...props },
        global: { stubs }
    })
    return wrapper
}

const findButton = (w: VueWrapper, pattern: RegExp): DOMWrapper<Element> | undefined =>
    w.findAll('button').find((item) => pattern.test(item.text()))

const textareaValue = (w: VueWrapper): string =>
    (w.find('textarea').element as HTMLTextAreaElement).value

describe('TaskExportDialog - 三态 loading / error / ready（§5.1 / AC5）', () => {
    it('ready（默认）⇒ 渲染 Markdown 文本域，无 LoadingError/JSON/HTML 视图', () => {
        const w = mountDialog()

        expect(w.find('.stub-loading-error').exists()).toBe(false)
        expect(w.find('textarea').exists()).toBe(true)
        expect(w.find('pre').exists()).toBe(false)
        expect(w.find('iframe').exists()).toBe(false)
    })

    it('loading ⇒ LoadingError loading 态，不渲染任何格式内容', () => {
        const w = mountDialog({ status: 'loading' })

        expect(w.find('[data-loading="true"]').exists()).toBe(true)
        expect(w.find('textarea').exists()).toBe(false)
        expect(w.find('pre').exists()).toBe(false)
        expect(w.find('iframe').exists()).toBe(false)
    })

    it('error ⇒ LoadingError error 态 + 错误文案 + 「重试」按钮，不渲染内容', () => {
        const w = mountDialog({ status: 'error', errorMessage: 'boom' })

        expect(w.find('[data-error="true"]').exists()).toBe(true)
        expect(w.find('.stub-error-message').text()).toBe('boom')
        expect(findButton(w, /重试|Retry/)).toBeTruthy()
        expect(w.find('textarea').exists()).toBe(false)
    })

    it('「重试」点击 ⇒ emit retry（框内重试入口）', async () => {
        const w = mountDialog({ status: 'error', errorMessage: 'boom' })

        await findButton(w, /重试|Retry/)!.trigger('click')

        expect(w.emitted('retry')).toHaveLength(1)
    })

    it('error → ready（重试成功）⇒ 内容出现且「重试」消失', async () => {
        const w = mountDialog({ status: 'error', errorMessage: 'boom' })

        await w.setProps({ status: 'ready' })

        expect(w.find('textarea').exists()).toBe(true)
        expect(findButton(w, /重试|Retry/)).toBeUndefined()
    })
})

describe('TaskExportDialog - 格式切换与可编辑性（§5.2 / AC2）', () => {
    it('顶部三个格式分段项；点击 JSON ⇒ emit update:format=json', async () => {
        const w = mountDialog()

        expect(w.find('[data-format="markdown"]').exists()).toBe(true)
        expect(w.find('[data-format="json"]').exists()).toBe(true)
        expect(w.find('[data-format="html"]').exists()).toBe(true)

        await w.find('[data-format="json"]').trigger('click')

        expect(w.emitted('update:format')).toEqual([['json']])
    })

    it('format=json ⇒ 只读 <pre> 展示 JSON 文本，不可编辑且无「还原」', () => {
        const json = '{\n  "formatVersion": 1\n}'
        const w = mountDialog({ format: 'json', json })

        expect(w.find('pre').text()).toBe(json)
        expect(w.find('textarea').exists()).toBe(false)
        expect(w.find('iframe').exists()).toBe(false)
        expect(findButton(w, /还原|Restore|恢复|Reset/i)).toBeUndefined()
    })

    it('format=html ⇒ iframe[sandbox=""] 预览，:srcdoc === 纯函数输出，不可编辑且无「还原」', () => {
        const node: ExportTaskNode = {
            name: '单据',
            state: 'todo',
            stateLabel: '待办',
            priorityLabel: '低',
            startAt: null,
            endAt: null,
            createdAt: '2026-09-19T02:00:00.000Z',
            updatedAt: '2026-09-19T03:00:00.000Z',
            description: '',
            checkItems: [],
            children: []
        }
        const html = generateTaskHtml(
            node,
            {
                lang: 'zh-CN',
                total: '合计',
                checkItems: '检查项',
                subTasks: '子任务',
                state: '状态',
                priority: '优先级',
                startAt: '开始',
                endAt: '截止',
                project: '项目',
                tags: '标签',
                createdAt: '创建',
                updatedAt: '更新',
                description: '说明',
                issuedAt: '开具于',
                documentNo: '单据号',
                generatedBy: '本单据由 nao-todo 生成于'
            } as never,
            '2026-09-23 10:30'
        )
        const w = mountDialog({ format: 'html', html })

        const iframe = w.find('iframe')
        expect(iframe.exists()).toBe(true)
        expect(iframe.attributes('srcdoc')).toBe(html)
        expect(iframe.attributes('sandbox')).toBe('')
        expect(iframe.attributes('title')).toBeTruthy()
        expect(w.find('textarea').exists()).toBe(false)
        expect(w.find('pre').exists()).toBe(false)
        expect(findButton(w, /还原|Restore|恢复|Reset/i)).toBeUndefined()
    })

    it('切走再切回 Markdown ⇒ 草稿保留（切换不重置 draft）', async () => {
        const w = mountDialog({ markdown: '# 原始' })

        await w.find('textarea').setValue('# 用户草稿')
        await w.setProps({ format: 'json', json: '{}' })
        await w.setProps({ format: 'markdown' })

        expect(textareaValue(w)).toBe('# 用户草稿')
    })

    it('「还原」仅在 Markdown 出现：json 隐藏、markdown 显示', async () => {
        const w = mountDialog({ markdown: '# 原始' })

        await w.setProps({ format: 'json', json: '{}' })
        expect(findButton(w, /还原|Restore|恢复|Reset/i)).toBeUndefined()

        await w.setProps({ format: 'markdown' })
        expect(findButton(w, /还原|Restore|恢复|Reset/i)).toBeTruthy()
    })

    it('内容区容器挂 .task-export-content，且源码声明 min-height: min(60vh, 32rem)', () => {
        const w = mountDialog()
        expect(w.find('.task-export-content').exists()).toBe(true)

        const sources = import.meta.glob('../export-dialog.vue', {
            query: '?raw',
            import: 'default',
            eager: true
        }) as Record<string, string>
        const source = Object.values(sources)[0] ?? ''
        expect(source).toContain('min-height: min(60vh, 32rem)')
    })
})

describe('TaskExportDialog - 三格式复制 payload（§5.2 / AC3）', () => {
    it('Markdown ⇒ 复制编辑后草稿', async () => {
        const w = mountDialog({ markdown: '# 原始' })

        await w.find('textarea').setValue('# 编辑后')
        await findButton(w, /复制|Copy/)!.trigger('click')

        expect(w.emitted('copy')?.at(-1)).toEqual(['# 编辑后'])
    })

    it('JSON ⇒ 复制 JSON 文本', async () => {
        const json = '{\n  "formatVersion": 1\n}'
        const w = mountDialog({ format: 'json', json })

        await findButton(w, /复制|Copy/)!.trigger('click')

        expect(w.emitted('copy')?.at(-1)).toEqual([json])
    })

    it('HTML ⇒ 复制完整 HTML 文档源码（含 <style>）', async () => {
        const html = '<!DOCTYPE html><html><head><style>.a{}</style></head><body></body></html>'
        const w = mountDialog({ format: 'html', html })

        await findButton(w, /复制|Copy/)!.trigger('click')

        expect(w.emitted('copy')?.at(-1)).toEqual([html])
    })
})