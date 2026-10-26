// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import dayjs from 'dayjs'
import { formatDuration } from '@nao-todo/presentation/pomodoro'
import { nueUI } from '@/nue-ui-register'
import { makeRecord, type MockRecordsContext } from './records-page-context-mock'
import {
    effectiveOverflowY,
    effectiveValue,
    narrowScopedDecls,
    parseCssRules,
    setViewport,
    styleTextOf,
    stubResizeObserver
} from './records-responsive-harness'

/**
 * T549 · 专注记录页「页面级」用例：三态（AC6）+ 分页（AC5）+ **桌面零变化基线（AC7）**
 *
 * 三态与分页：真实挂载 `records/index.vue` 及全部子组件（只替换数据来源 `use-records-table`,
 * 见 `records-page-context-mock.ts`）⇒ 页面结构与 `LoadingError` / `Pager` 的真实渲染仍被测。
 *
 * **AC7 桌面零变化（负向闭环）**：用**真实组件挂载 + 打印实测值**做基线式断言
 * （遵循 `AGENTS.md`「前端验证纪律」2026-10-23：禁 stub 推断、禁静态猜测）。
 * 基线 = **改造前**（本文件提交时刻）的实测 DOM 指纹与桌面生效 CSS 值；rd-fe 改造后若漂移即为红。
 * ⚠️ jsdom 无布局引擎（高度/几何恒 0）⇒ 这里冻结的是「列顺序 / 类名 / 文本 / 列宽 / 字号 / 粘性表头」
 *    这类**可由源码与 DOM 唯一确定的量**；像素级观感仍归用户真机走查。
 */

const hoisted = vi.hoisted(() => ({ context: null as unknown }))

vi.mock('../use-records-table', async () => {
    const { createMockRecordsContext } = await import('./records-page-context-mock')
    const context = createMockRecordsContext()
    hoisted.context = context
    return {
        provideRecordsTableContext: () => context,
        useRecordsTable: () => context,
        POMODORO_RECORDS_TABLE_CONTEXT_KEY: Symbol('T549_MOCK_CONTEXT')
    }
})

import RecordsPage from '../index.vue'

const mockContext = (): MockRecordsContext => hoisted.context as MockRecordsContext

const MOBILE = 360
const DESKTOP = 1280

let restoreViewport: (() => void) | null = null

beforeAll(() => {
    stubResizeObserver()
})

beforeEach(() => {
    restoreViewport?.()
    restoreViewport = null
    const context = mockContext()
    context.records.value = []
    context.loading.value = false
    context.error.value = ''
    context.pagination.page = 1
})

afterAll(() => {
    restoreViewport?.()
})

const mountPage = async (width: number): Promise<VueWrapper> => {
    restoreViewport?.()
    restoreViewport = setViewport(width)
    const wrapper = mount(RecordsPage, {
        global: {
            plugins: [nueUI],
            stubs: { PomodoroHeader: true }
        }
    })
    await flushPromises()
    return wrapper
}

const loadingErrorOf = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'LoadingError' })
const pagerOf = (wrapper: VueWrapper) => wrapper.findComponent({ name: 'Pager' })

const cssModules = import.meta.glob<string>('../*.vue', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** 记录页某 SFC 的原始源码（glob 未命中即空串 ⇒ 断言直接失败，不静默通过） */
const sourceOf = (fileName: string): string => {
    const key = Object.keys(cssModules).find((moduleKey) => moduleKey.endsWith(`/${fileName}`))
    return key ? (cssModules[key] ?? '') : ''
}

/** 记录页某 SFC 的生效 CSS 值（按视口宽度推演，含 `@media` 与 CSS 嵌套） */
const cssValue = (fileName: string, selector: string, prop: string, width: number) =>
    effectiveValue(parseCssRules(styleTextOf(sourceOf(fileName))), selector, prop, width)

const cssOverflowY = (fileName: string, selector: string, width: number) =>
    effectiveOverflowY(parseCssRules(styleTextOf(sourceOf(fileName))), selector, width)

describe('T549 AC6 三态（真实挂载 @360px）', () => {
    it('AC6 ③ 空态：LoadingError(empty) 居中呈现，分页不渲染', async () => {
        const wrapper = await mountPage(MOBILE)
        const loadingError = loadingErrorOf(wrapper)
        const measured = {
            exists: loadingError.exists(),
            empty: loadingError.props('empty'),
            loading: loadingError.props('loading'),
            error: loadingError.props('error'),
            emptyMessage: loadingError.props('emptyMessage'),
            pager: pagerOf(wrapper).exists(),
            emptyNode: wrapper.find('.nue-empty').exists()
        }
        console.log('[AC6-③] 空态实测：', measured)

        expect(measured.empty).toBe(true)
        expect(measured.loading).toBe(false)
        expect(measured.emptyMessage).toBe('暂无专注记录')
        expect(measured.emptyNode, '空态未由 LoadingError/nue-empty 呈现（R7 禁止自绘）').toBe(true)
        expect(measured.pager, '空态仍渲染分页 ⇒ 分页会被顶出屏幕').toBe(false)
        wrapper.unmount()
    })

    it('AC6 ④ 错误态：错误信息 + 重试按钮（error slot），分页不渲染', async () => {
        const context = mockContext()
        context.error.value = '网络异常'
        context.loadFirstPage = vi.fn()
        const wrapper = await mountPage(MOBILE)
        const loadingError = loadingErrorOf(wrapper)
        const retry = loadingError.findAll('.nue-button')
        const measured = {
            error: loadingError.props('error'),
            text: wrapper.text().replace(/\s+/g, ' ').trim(),
            buttons: retry.length,
            pager: pagerOf(wrapper).exists()
        }
        console.log('[AC6-④] 错误态实测：', measured)

        expect(measured.error).toBe(true)
        expect(measured.text).toContain('网络异常')
        expect(measured.buttons, '错误态缺重试按钮').toBeGreaterThan(0)
        expect(measured.pager).toBe(false)

        await retry[0]!.trigger('click')
        expect(context.loadFirstPage).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('AC6 ⑤ 加载态：LoadingError(loading) 呈现，分页不渲染', async () => {
        const context = mockContext()
        context.loading.value = true
        const wrapper = await mountPage(MOBILE)
        const loadingError = loadingErrorOf(wrapper)
        const measured = {
            loading: loadingError.props('loading'),
            empty: loadingError.props('empty'),
            loadingPlaceholder: wrapper.find('.nue-loading').exists(),
            pager: pagerOf(wrapper).exists()
        }
        console.log('[AC6-⑤] 加载态实测：', measured)

        expect(measured.loading).toBe(true)
        expect(measured.empty).toBe(false)
        expect(measured.pager).toBe(false)
        wrapper.unmount()
    })
})

describe('T549 AC5 分页（真实挂载 @360px）', () => {
    it('AC5 ④ 点「下一页」透传 goToPage(2)，且不把滚动位置归零', async () => {
        const context = mockContext()
        context.records.value = Array.from({ length: 10 }, (_, index) => makeRecord(index + 1))
        context.goToPage = vi.fn()
        const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

        const wrapper = await mountPage(MOBILE)
        const pagerText = pagerOf(wrapper).text().replace(/\s+/g, ' ').trim()
        const next = wrapper.find('.pomodoro-records-page__pagination .icon-arrow-right')
        const measured = { pagerText, nextExists: next.exists() }
        console.log('[AC5-④] 分页实测：', measured)

        expect(measured.pagerText).toContain('第 1 页')
        expect(measured.nextExists, '分页「下一页」按钮不可达').toBe(true)

        await next.trigger('click')
        expect(context.goToPage).toHaveBeenCalledWith(2)
        expect(scrollToSpy, '切页调用了 scrollTo ⇒ 用户会被弹回页面顶端').not.toHaveBeenCalled()

        scrollToSpy.mockRestore()
        wrapper.unmount()
    })
})

describe('T549 R11 分页箭头居中（真实挂载 @360px + 源级判据）', () => {
    it('R11 ① 箭头在按钮内水平居中：icon 变体 / `--nue-button-alignment: center` / 显式 flex 居中（三选一）', async () => {
        const context = mockContext()
        context.records.value = [makeRecord(1)]
        const wrapper = await mountPage(MOBILE)

        // 形态①：真实挂载取证 —— 分页按钮是否都是 icon 变体（`--icon` 会把 alignment 置 center）
        const buttons = wrapper.findAll('.pomodoro-records-page__pagination .nue-button')
        const buttonClasses = buttons.map((button) => button.classes().join(' '))
        const iconVariant =
            buttons.length > 0 &&
            buttons.every((button) => button.classes().includes('nue-button--icon'))

        // 形态②/③：源级 —— 窄屏分支内改主题自身的 alignment，或显式 flex 居中
        const narrowButtonDecls = narrowScopedDecls(
            parseCssRules(styleTextOf(sourceOf('index.vue'))),
            MOBILE,
            /nue-button/
        )
        const alignmentCenter = narrowButtonDecls.some(
            (decl) => decl.prop === '--nue-button-alignment' && decl.value === 'center'
        )
        const flexCentered =
            narrowButtonDecls.some(
                (decl) => decl.prop === 'justify-content' && decl.value === 'center'
            ) &&
            narrowButtonDecls.some((decl) => decl.prop === 'align-items' && decl.value === 'center')

        console.log('[R11-①] 证据：', {
            buttonCount: buttons.length,
            buttonClasses,
            iconVariant,
            alignmentCenter,
            flexCentered
        })

        expect(
            iconVariant || alignmentCenter || flexCentered,
            '箭头未居中：需 icon 变体（`nue-button--icon`）或窄屏 `--nue-button-alignment: center`（与 icon 同机制）或显式 `justify-content/align-items: center`'
        ).toBe(true)

        wrapper.unmount()
    })
})

describe('T549 AC7 桌面零变化（§1280px 基线快照：真实挂载 + 打印实测值）', () => {
    const records = [1, 2, 3].map((index) => ({
        id: `d${index}`,
        sessionId: `ds${index}`,
        type: index === 1 ? 1 : 2,
        startAt: `2026-10-0${index}T1${index}:00:00.000Z`,
        endAt: `2026-10-0${index}T1${index}:25:00.000Z`,
        duration: 1500,
        pomodoroId: 'p1',
        taskId: `dt${index}`,
        taskName: `桌面任务 ${index}`,
        description: '',
        note: '',
        createdAt: '',
        updatedAt: '',
        deletedAt: null
    }))

    it('AC7 ① 桌面 DOM 指纹：列顺序 / 单元格类名 / 文本 / 分页文本（改造前基线）', async () => {
        const context = mockContext()
        context.records.value = records
        const wrapper = await mountPage(DESKTOP)

        const headerCells = wrapper.findAll(
            '.pomodoro-records-table__header .pomodoro-records-table__cell'
        )
        const firstRow = wrapper.find('.pomodoro-records-table__body .pomodoro-records-table__row')
        const rowCells = firstRow.findAll('.pomodoro-records-table__cell')

        const measured = {
            headerLabels: headerCells.map((cell) => cell.text()),
            rowCellClasses: rowCells.map((cell) => cell.classes().join(' ')),
            rowCellTexts: rowCells.map((cell) => cell.text()),
            rowCount: wrapper.findAll('.pomodoro-records-table__row').length,
            pagerText: pagerOf(wrapper).text().replace(/\s+/g, ' ').trim()
        }
        console.log('[AC7-①] 1280px DOM 指纹实测：', JSON.stringify(measured, null, 2))

        // —— 冻结基线（改造前实测值）——
        expect(measured.headerLabels).toEqual([
            '类型',
            '任务名称',
            '专注模板',
            '时长',
            '开始时间',
            '结束时间',
            '操作'
        ])
        expect(measured.rowCellClasses).toEqual([
            'pomodoro-records-table__cell pomodoro-records-table__cell--type',
            'pomodoro-records-table__cell pomodoro-records-table__cell--task',
            'pomodoro-records-table__cell pomodoro-records-table__cell--template',
            'pomodoro-records-table__cell pomodoro-records-table__cell--duration',
            'pomodoro-records-table__cell pomodoro-records-table__cell--time',
            'pomodoro-records-table__cell pomodoro-records-table__cell--time',
            'pomodoro-records-table__cell pomodoro-records-table__cell--actions'
        ])
        expect(measured.rowCellTexts).toEqual([
            '番茄钟',
            '桌面任务 1',
            '模板A',
            formatDuration(1500),
            dayjs(records[0]!.startAt).format('HH:mm'),
            dayjs(records[0]!.endAt).format('HH:mm'),
            ''
        ])
        expect(measured.rowCount).toBe(records.length)
        expect(measured.pagerText).toContain('第 1 页，共 2 页')
        wrapper.unmount()
    })

    it('AC7 ② 桌面表格列宽 / 字号 / 粘性表头 / 760px 硬宽逐项不变', () => {
        const measured = {
            headerMinWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__header',
                'min-width',
                DESKTOP
            ),
            bodyMinWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__body',
                'min-width',
                DESKTOP
            ),
            headerPosition: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__header',
                'position',
                DESKTOP
            ),
            headerTop: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__header',
                'top',
                DESKTOP
            ),
            headerFontSize: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__header',
                'font-size',
                DESKTOP
            ),
            rowFontSize: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__row',
                'font-size',
                DESKTOP
            ),
            typeWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--type',
                'width',
                DESKTOP
            ),
            taskMinWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--task',
                'min-width',
                DESKTOP
            ),
            templateWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--template',
                'width',
                DESKTOP
            ),
            durationWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--duration',
                'width',
                DESKTOP
            ),
            timeWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--time',
                'width',
                DESKTOP
            ),
            actionsWidth: cssValue(
                'table-main.vue',
                '.pomodoro-records-table__cell--actions',
                'width',
                DESKTOP
            )
        }
        console.log('[AC7-②] 1280px 生效 CSS 实测：', measured)

        // —— 冻结基线（改造前实测值）——
        expect(measured.headerMinWidth).toBe('760px')
        expect(measured.bodyMinWidth).toBe('760px')
        expect(measured.headerPosition).toBe('sticky')
        expect(measured.headerTop).toBe('0')
        expect(measured.headerFontSize).toBe('var(--nue-text-sm)')
        expect(measured.rowFontSize).toBe('var(--nue-text-sm)')
        expect(measured.typeWidth).toBe('100px')
        expect(measured.taskMinWidth).toBe('120px')
        expect(measured.templateWidth).toBe('140px')
        expect(measured.durationWidth).toBe('100px')
        expect(measured.timeWidth).toBe('80px')
        expect(measured.actionsWidth).toBe('60px')
    })

    it('AC7 ③ 桌面不得新增滚动容器，分页仍右对齐（窄屏改造不得渗到桌面）', () => {
        const measured = {
            pageOverflowY: cssOverflowY('index.vue', '.pomodoro-records-page', DESKTOP),
            contentOverflowY: cssOverflowY('index.vue', '.nue-content', DESKTOP),
            paginationJustify: cssValue(
                'index.vue',
                '.pomodoro-records-page__pagination',
                'justify-content',
                DESKTOP
            ),
            paginationPaddingTop: cssValue(
                'index.vue',
                '.pomodoro-records-page__pagination',
                'padding-top',
                DESKTOP
            )
        }
        console.log('[AC7-③] 1280px 桌面行为实测：', measured)

        // 桌面「观感零变化」的机理：不出现新的滚动条（改造前整块内容被裁切、页面不自滚）
        expect(['auto', 'scroll']).not.toContain(measured.pageOverflowY)
        expect(['auto', 'scroll']).not.toContain(measured.contentOverflowY)
        expect(measured.paginationJustify).toBe('flex-end')
        expect(measured.paginationPaddingTop).toBe('var(--nue-padding-sm)')
    })

    it('AC7 ④ 无新增请求 / 分页参数不变：Pager 仅透传既有分页状态', async () => {
        const context = mockContext()
        context.records.value = records
        const wrapper = await mountPage(DESKTOP)

        const pager = pagerOf(wrapper)
        const measured = {
            page: pager.props('page'),
            limit: pager.props('limit'),
            total: pager.props('total'),
            totalPages: pager.props('totalPages')
        }
        console.log('[AC7-④] Pager props 实测：', measured)

        expect(measured).toEqual({ page: 1, limit: 20, total: 40, totalPages: 2 })
        wrapper.unmount()
    })
})