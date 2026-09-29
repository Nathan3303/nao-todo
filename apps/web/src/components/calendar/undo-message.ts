import { h } from 'vue'
import { NueMessage, type NueMessageHandle } from 'nue-ui'
import UndoMessageExtension from './undo-message-extension.vue'
import type { ScheduleUndoAction } from './monthly/reschedule'

/**
 * U2 撤销呈现（T362：改走 NueMessage 的 `extension` 扩展内容）
 * @description 取代原「自研 toast + 单挂载点注入通道」（`monthly/undo-toast.vue` +
 *              `undo-sink.ts`）：撤销入口 = 库消息，动作与撤销按钮（扩展区）同框，
 *              位置/主题/入场动画由库统一（`--nue-message-node-inner-*` 令牌与旧实现同源）。
 *
 *              单一入口不变量（全节仅一条撤销入口）由**模块级句柄注册表**保证：
 *              新动作出现 ⇒ 先 `close()` 上一条消息（连同其超时计时）并令旧入口即刻失效，
 *              再开新的一条 —— 因此不存在两 toast 并存，也无需宿主独占挂载点。
 *
 *              数据面不变：`ScheduleUndoAction` / 快照回写仍由 `useCalendarSchedule` 提供，
 *              本模块只负责「呈现 + 收口」。
 */

/** 停留时长约 5s（超时不可撤销为既定语义 A1-U2-06；与库 `duration` 同值） */
export const UNDO_MESSAGE_DURATION = 5000

/** 单条撤销的呈现载荷（按 `useCalendarSchedule` 实例身份构造，用于只关自己那一条） */
export type ScheduleUndoPresentation = {
    action: ScheduleUndoAction
    /** 状态机取值（idle → busy → undone / failed）：扩展区文案与可用性只由它驱动 */
    status: () => ScheduleUndoStatus
    undo: () => void
    /** 令该入口失效（撤销完成后的收口 / 超时失效） */
    dismiss: () => void
}

/**
 * 撤销入口状态机（T364）
 * @description idle=可撤销；busy=写回中（防连点）；undone=**成功终态**（不可再操作、文案变更）；
 *              failed=写回失败（保留入口、仍可点以重试）。仅当写回全部成功才进入 undone
 *              （禁止乐观置位）。
 */
export type ScheduleUndoStatus = 'idle' | 'busy' | 'undone' | 'failed'

type ActiveUndoMessage = {
    handle: NueMessageHandle
    presentation: ScheduleUndoPresentation
    timer: ReturnType<typeof setTimeout>
}

/** 当前唯一的撤销消息（模块级 ⇒ 跨实例单入口，替代原 undo-sink 的宿主唯一挂载点） */
let active: ActiveUndoMessage | null = null

/** 扩展区 VNode（惰性：由库在消息内部渲染时调用） */
const extensionOf = (presentation: ScheduleUndoPresentation) => () =>
    h(UndoMessageExtension, {
        text: presentation.action.text,
        status: presentation.status,
        undo: presentation.undo
    })

/**
 * 打开撤销消息（单一入口不变量）
 * @description 若已有消息：先关掉（清计时 + `close()`）再开新的一条。
 *              ⚠️ 刻意**不**调旧载荷的 `dismiss()`：旧载荷与本条可能属于同一实例，
 *              其 `dismiss()` 会置空同一个 `undoAction` ref，反而把刚设的新动作清掉
 *              （并使其 watch 反向关掉新消息）。旧入口靠「消息已被关闭」变得不可达，
 *              其快照由后续新动作/卸载自然收敛。
 */
export const presentScheduleUndo = (presentation: ScheduleUndoPresentation): void => {
    const previous = active
    active = null
    if (previous) {
        clearTimeout(previous.timer)
        previous.handle.close()
    }
    const handle = NueMessage({
        // 主文案改由扩展区组件渲染（库 `message` 为静态 prop，无法随状态更新）；
        // 传空串而非省略，避免库默认占位「No content.」
        message: '',
        type: presentation.action.tone === 'warning' ? 'warning' : 'success',
        duration: UNDO_MESSAGE_DURATION,
        extension: extensionOf(presentation)
    })
    const timer = setTimeout(() => {
        if (active?.presentation !== presentation) return
        const current = active
        active = null
        current.handle.close()
        presentation.dismiss()
    }, UNDO_MESSAGE_DURATION)
    active = { handle, presentation, timer }
}

/**
 * 关闭撤销消息（幂等）
 * @description 传 `presentation` 时**只**关闭同一实例的那一条：实例被清除（撤销完成/卸载）
 *              时不得误关后来居上的新入口。
 */
export const closeScheduleUndo = (presentation?: ScheduleUndoPresentation): void => {
    const current = active
    if (!current) return
    if (presentation && current.presentation !== presentation) return
    active = null
    clearTimeout(current.timer)
    current.handle.close()
}