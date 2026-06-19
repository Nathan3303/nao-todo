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
    /** 用户可见的名称，用于命令面板展示 */
    label: string
    /** 详细描述 */
    description?: string
    /** 分组名称，命令面板中按组归类 */
    group?: string
    /** 图标标识 */
    icon?: string
    /** 执行函数 */
    handler: (event?: KeyEvent) => void
    /** 快捷键绑定 */
    keyboard?: KeyboardBinding
    /** 可用性判断，返回 false 时命令不可执行 */
    available?: (context: { scope: string }) => boolean
}

/**
 * 作用域状态
 * @description 作用域在栈中的状态
 */
export interface ScopeState {
    name: string
}
