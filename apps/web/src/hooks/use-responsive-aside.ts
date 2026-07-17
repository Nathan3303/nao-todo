import { computed, ref, watch, type Ref } from 'vue'

const useResponsiveAside = (responsiveFlags: Ref<number>, responsiveType: number) => {
    // @state 可见性
    const visible = ref<boolean>(false)

    // @computed 是否使用浮动栏
    const isFloating = computed(() => {
        return responsiveFlags.value <= responsiveType
    })

    // @watch 监听响应式标记变化 - 如果当前设备类型不再使用浮动栏，则强制显示侧边栏
    watch(isFloating, (newVal) => (visible.value = !newVal), { immediate: true })

    // @method 切换可见性
    const switchVisible = () => {
        visible.value = !visible.value
    }

    // @returns
    return { visible, isFloating, switchVisible }
}

export default useResponsiveAside

