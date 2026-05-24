// import { debounce } from '@nao-todo/utils'
import { ref } from 'vue'

// @state 响应式标记 -  0: 移动端 | 1-2: 移动端 (平板) | 3-4: 桌面端 | 5: 桌面端 (大屏) | 6: 电视
const responsiveWidths = [445, 800, 1200, 1600, 1920, 2560, 3840]

// @constants 响应式标记常量
export const responsiveTypes = {
    MOBILE: 0,
    MOBILE_TABLE: 2,
    DESKTOP: 4,
    DESKTOP_LARGE: 5,
    TV: 6
}

const useResponsiveFlag = () => {
    // @state 当前响应式标记
    const flag = ref<number>(0)

    // @state 宽度备份
    // let widthBk = 0

    // @state 元素监听器
    let resizeObserver: ResizeObserver | null = null

    // @method 响应式检测 - 递归检测当前设备类型
    const checker = (width: number) => {
        for (let idx = 0; idx < responsiveWidths.length; idx++) {
            const w = responsiveWidths[idx]
            if (!w) return
            if (width > w) continue
            // console.log(width, w)
            flag.value = idx - 1
            return
        }
    }

    // @onUsed 判断监听器是否存在 - 不存在则创建
    if (!resizeObserver) {
        // 创建
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width
                checker(width)
                // console.log(width, flag.value)
                // responsiveFlag.width = width
            }
        })
        // 监听窗口变化
        resizeObserver.observe(window.document.body)
    }

    // // @method 响应式标记类型检测 - 检测当前设备类型是否为指定类型
    // const typeCheck = (type: number) => {
    //     return flag.value <= type
    // }

    // @onUsed 在开始时检测一次
    // checker(window.document.body.clientWidth)
    // console.log(responsiveFlag)

    // @returns
    return { flag }
}

export default useResponsiveFlag
