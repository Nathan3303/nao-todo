import { nextTick, ref } from 'vue'

/**
 * useMonthJump —— 标题年-月跳转面板状态机（O2 抽取；C2-F9 月/周视图共用）
 * @description open/pos/titleEl + toggle（再点收起）/close（归还焦点）状态机；
 *              选中回调由调用方注入（月视图跳月 / 周视图落周，跳转语义各异）。
 */

/** 面板定位常量（视口边缘向内收拢，避免溢出） */
const PANEL_MARGIN = 4
const PANEL_WIDTH = 248
const PANEL_HEIGHT = 260

export const useMonthJump = (opts: { onSelect: (year: number, month: number) => void }) => {
    const open = ref(false)
    const pos = ref({ x: 0, y: 0 })
    const titleEl = ref<HTMLElement | null>(null)

    // @method 关闭并归还焦点（面板弹层关闭惯例）
    const close = (): void => {
        open.value = false
        void nextTick(() => titleEl.value?.focus())
    }

    // @method 标题点击：开/关 toggle；定位以标题按钮为锚点（向内收拢）
    const toggle = (event: MouseEvent): void => {
        if (open.value) {
            close()
            return
        }
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        pos.value = {
            x: Math.min(Math.max(PANEL_MARGIN, rect.left), window.innerWidth - PANEL_WIDTH),
            y: Math.min(Math.max(PANEL_MARGIN, rect.bottom + 4), window.innerHeight - PANEL_HEIGHT)
        }
        open.value = true
    }

    // @method 选中年月：执行调用方跳转语义后收起
    const select = (year: number, month: number): void => {
        opts.onSelect(year, month)
        close()
    }

    return { open, pos, titleEl, close, toggle, select }
}