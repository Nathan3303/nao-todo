import { computed, ref, type Ref } from 'vue'

const useResponsiveAside = (responsiveFlags: Ref<number>, responsiveType: number) => {
    // @state 可见性
    const visible = ref<boolean>(false)

    // @computed 是否使用浮动栏
    const isFloating = computed(() => {
        const is = responsiveFlags.value <= responsiveType
        visible.value = !is
        return is
    })

    // @method 切换可见性
    const switchVisible = () => {
        visible.value = !visible.value
    }

    // @returns
    return {
        visible,
        isFloating,
        switchVisible
    }
}

export default useResponsiveAside
