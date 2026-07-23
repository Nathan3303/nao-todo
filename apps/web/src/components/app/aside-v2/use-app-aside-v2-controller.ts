import { useResponsiveAside, responsiveTypes } from '@nao-todo/shared'
import { nextTick, Ref, shallowRef, watch } from 'vue'

export type AppAsideV2ControlOption = {
    useSlot: boolean
    useDrawerSlot: boolean
}

// type AppAsideV2ControllerMap = Map<string, AppAsideV2ControlOption>

export const useAppAsideV2Controller = (responsiveFlags: Ref<number>) => {
    // @hook 响应式侧栏状态
    const { visible, isFloating, switchVisible } = useResponsiveAside(
        responsiveFlags,
        responsiveTypes.MOBILE
    )

    // @state 侧栏配置
    const option = shallowRef<AppAsideV2ControlOption>({
        useSlot: true,
        useDrawerSlot: true
    })

    // @action 修改侧栏配置
    const setOption = (newOption: AppAsideV2ControlOption) => {
        option.value = newOption
    }

    // @method 处理显示与隐藏
    // 当配置的 useSlot 为 false 且非使用抽屉式侧栏时，占位侧栏永远隐藏
    const switchDisplayAside = () => {
        if (isFloating || option.value.useSlot) {
            switchVisible()
            return
        }
        visible.value = false
    }

    // @watch 监听响应式检测结果
    watch(isFloating, (nv) => {
        if (nv) return
        visible.value = false
        nextTick(() => (visible.value = option.value.useSlot))
    })

    // @watch 当侧栏配置变化后，匹配一次初始值至 visible 以适配视图
    watch(option, (nv) => (visible.value = nv.useSlot), { immediate: true })

    // @returns
    return {
        isDisplayAside: visible,
        isUseFloatAside: isFloating,
        switchDisplayAside,
        setControllOption: setOption
    }
}

