/**
 * 填充数字为两位
 * @param n 数字
 * @returns 填充后的两位数字字符串
 */
export const pad = (n: number) => {
    return n.toString().padStart(2, '0')
}

/**
 * 任务提醒设置器时间输入框获得焦点时选中所有内容
 * @param e 事件
 */
export const onFocus = (e: Event) => {
    ;(e.target as HTMLInputElement).select()
}

