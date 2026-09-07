/**
 * C1-F8 键盘导航 - 纯逻辑/常量模块
 * @description 与视图解耦的键位帮助函数：calendar 作用域名、弹层抑制谓词、
 *              Enter 交互控件目标守卫（可单测；DOM 查询依赖由调用方注入 document/target）。
 */

/** calendar 键位作用域（进入日历挂载激活、离开卸载失效；C-F8-08 门控） */
export const CALENDAR_KEY_SCOPE = 'calendar'

/**
 * 弹层集合键盘抑制谓词（PM 决议 Q1/Q2：全部导航键在弹层开启期间一律抑制）
 * @description 命中即抑制：① F4 改期菜单/日期面板所在浮层（.rmenu，月/周条与抽屉行同源）
 *              ② 任意 Nue 弹层激活（popup-pool data-actived=true；含日期面板/当日面板/
 *              未安排抽屉/任务详情/对话框/F9 面板等）。
 *              undo-toast / NueMessage 轻提示不在 pool、不构成抑制（Q2 收窄口径）。
 * @param doc document 或同构查询对象（测试注入假对象）
 */
export const isCalendarKeyLocked = (doc: {
    querySelector(selector: string): Element | null
}): boolean =>
    !!doc.querySelector('.rmenu') ||
    !!doc.querySelector('.month-jump-panel') ||
    !!doc.querySelector('.nue-popup-pool[data-actived="true"]')

/** 交互可聚焦控件选择器（Enter 目标守卫：命中则放行原生激活，不执行"开当日面板"） */
export const INTERACTIVE_KEY_TARGET_SELECTOR =
    'button, a, select, input, textarea, [role="button"], [contenteditable="true"], [contenteditable=""]'

/**
 * Enter 目标守卫（PM 决议 Q2）：keydown 目标为可聚焦交互控件时放行原生激活
 * @param target 事件目标（浏览器为 Element；测试可为含 closest 的假对象）
 */
export const isInteractiveKeyTarget = (target: unknown): boolean => {
    const el = target as { closest?: (selector: string) => unknown } | null
    return !!el && typeof el.closest === 'function' && !!el.closest(INTERACTIVE_KEY_TARGET_SELECTOR)
}