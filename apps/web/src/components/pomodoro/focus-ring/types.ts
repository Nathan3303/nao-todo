/**
 * PomodoroFocusRing 组件属性
 */
export interface PomodoroFocusRingProps {
    /** 是否运行中（显示旋转动画） */
    isRunning: boolean
    /** 外环颜色（默认灰色） */
    outerColor?: string
    /** 圆环宽度（默认 3px） */
    strokeWidth?: number
    /** 内环颜色（默认主色） */
    innerColor?: string
    /** 内环缩放比例（默认 0.9） */
    scale?: number
}

