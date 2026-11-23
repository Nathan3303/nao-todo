import type { LocaleKey } from '../locales/types'

/**
 * 修饰键类型
 * @description 支持的所有修饰键
 */
export type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta' | '$mod'

/**
 * 平台类型
 * @description 当前运行平台
 */
export type Platform = 'mac' | 'win' | 'linux'

/**
 * 快捷键绑定信息
 * @description 命令的快捷键绑定配置
 */
export interface KeyboardBinding {
    /** 快捷键字符串，如 "$mod+k"、"ctrl+shift+n"、"Escape" */
    keys: string
    /** 绑定的作用域名称，默认 "global" */
    scope?: string
    /** 是否阻止浏览器默认行为 */
    preventDefault?: boolean
    /** 生效平台，不传则所有平台生效 */
    platforms?: Platform[]
}

/**
 * 归一化按键事件
 * @description 与平台无关的按键事件表示，不依赖 DOM KeyboardEvent
 */
export interface KeyEvent {
    key: string
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    shiftKey: boolean
}

/**
 * 解析后的快捷键
 * @description parseKeys 的输出，用于与 KeyEvent 匹配
 */
export interface ParsedKey {
    key: string
    modifiers: Set<Modifier>
}

/**
 * 命令
 * @description 一个可执行的命令，包含元数据和执行逻辑
 */
export interface Command {
    /** 唯一标识，如 "task.create" */
    id: string
    /** 用户可见的名称（无 `i18n.label` 时的兜底字面量；两者皆缺时展示 id） */
    label?: string
    /** 详细描述 */
    description?: string
    /** 分组名称，命令面板中按组归类 */
    group?: string
    /**
     * 展示文案的 i18n 键
     * @description 命令面板 / 快捷键帮助优先取此处（缺省回落 `label` / `description` / `group`）。
     *              存键而非取值：语言切换后重新渲染即生效（注册期不冻结语言）。
     */
    i18n?: { label?: LocaleKey; description?: LocaleKey; group?: LocaleKey }
    /** 图标标识 */
    icon?: string
    /** 执行函数 */
    handler: (event?: KeyEvent) => void
    /** 快捷键绑定 */
    keyboard?: KeyboardBinding
    /**
     * 非键盘手势提示（如 `"$mod+wheel"`，day 视图缩放）
     * @description **仅用于命令面板 / 快捷键帮助展示**，不参与 `keydown` 匹配
     *              （手势由组件自身的事件监听实现，见 `use-day-viewport.ts`）。
     */
    gesture?: string
    /** 不在命令面板中列出（如命令面板自身的开关命令；仍可经快捷键触发，仍进快捷键帮助） */
    hidden?: boolean
    /** 可用性判断，返回 false 时命令不可执行（context.event = 触发按键的原始 DOM 事件，供目标守卫等判定） */
    available?: (context: { scope: string; event?: KeyboardEvent }) => boolean
}

/**
 * 作用域状态
 * @description 作用域在栈中的状态
 */
export interface ScopeState {
    name: string
}