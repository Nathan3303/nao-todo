import { ref } from 'vue'

// @states 响应式标记 -  0: 移动端 | 1-2: 移动端 (平板) | 3-4: 桌面端 | 5: 桌面端 (大屏) | 6: 电视
const responsiveWidths = [445, 800, 1200, 1600, 1920, 2560, 3840]

export default () => {
    const responsiveFlag = ref<number>(0)

    const checker = (width: number, flag: number): number => {
        if (flag < 0 || flag >= responsiveWidths.length) return flag
        const resWidth = responsiveWidths[flag]
        if (!resWidth) return flag
        if (width < resWidth) {
            return checker(width, flag - 1)
        }
        return checker(width, flag + 1)
    }

    return {
        responsiveFlag,
        // @methods 响应式检测 - 通过 window.innerWidth 和 window.resize 检测
        responsiveFlagUpdater: (width: number) => checker(width, responsiveFlag.value)
    }
}
