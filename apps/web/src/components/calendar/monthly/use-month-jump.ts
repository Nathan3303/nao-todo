import { nextTick, ref } from 'vue'

/**
 * useMonthJump —— 标题年-月跳转 NueDropdown 状态（TASK-09：month-jump-panel 迁移）
 * @description C2-F9 月/周视图共用：标题按钮 ref（关闭归还焦点）+ 弹层开合态（供年-月网格
 *              打开时复位可视年）+ execute 解析（月格 data-executeid "YYYY-MM-01" → 年/月）。
 *              弹层开合/定位/Esc/外点关闭由 NueDropdown 内建承担，不再手写弹层状态机。
 */

/** execute id 格式：monthFirstDateKey(year, month) 即 "YYYY-MM-01" */
const EXECUTE_ID_PATTERN = /^(\d{4})-(\d{2})/

export const useMonthJump = (opts: { onSelect: (year: number, month: number) => void }) => {
    // @state 标题按钮（关闭弹层后归还焦点）
    const titleEl = ref<HTMLElement | null>(null)
    // @state 弹层开合（@open/@close 同步；供年-月网格 active 复位可视年）
    const open = ref(false)

    // @method @open：记录开合（网格复位可视年）
    const onOpen = (): void => {
        open.value = true
    }

    // @method @close：记录开合 + 归还焦点到标题按钮（弹层关闭惯例，NueDropdown 内建关闭触发）
    const onClose = (): void => {
        open.value = false
        void nextTick(() => titleEl.value?.focus())
    }

    // @method @execute：解析 "YYYY-MM-01" → 调用方跳转语义（月视图跳月 / 周视图落周，各异）
    const onExecute = (id: string): void => {
        const match = EXECUTE_ID_PATTERN.exec(id)
        if (!match) return
        opts.onSelect(Number(match[1]), Number(match[2]))
    }

    return { titleEl, open, onOpen, onClose, onExecute }
}