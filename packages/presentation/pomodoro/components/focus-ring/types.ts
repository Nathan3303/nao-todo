/**
 * PomodoroFocusRing 组件属性
 */
export interface PomodoroFocusRingProps {
    /** 是否运行中（显示旋转动画）；进度模式下忽略 */
    isRunning: boolean
    /** 进度百分比（0-100）。传入即启用「进度弧模式」，不传为「旋转/静态模式」 */
    percentage?: number
    /** 外环/轨道颜色（默认灰色） */
    outerColor?: string
    /** 圆环宽度（默认 6px） */
    strokeWidth?: number
    /** 进度弧颜色（进度模式下使用，默认主色） */
    innerColor?: string
    /** 缩放比例（默认 1） */
    scale?: number
}