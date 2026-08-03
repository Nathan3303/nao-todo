import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { getAvatarSrc } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'

export const useAppAsideV2 = () => {
    // @context
    const { routerLinks } = inject(APP_CONTEXT_KEY)!
    const { isDisplayAside, isUseFloatAside, switchDisplayAside, asideWidth, handleResizeAside } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    // @stores
    const userStore = useUserStore()

    // @presetStates
    const { profile, userToken } = storeToRefs(userStore)

    // @computed 头像地址（携带登录凭证）
    const avatarSrc = computed(() => getAvatarSrc(profile.value?.avatar || '', userToken.value))

    // @state 最小宽度
    const minWidth = computed(() => {
        return isDisplayAside.value ? '300px' : '70px'
    })

    // @state 最大宽度
    const maxWidth = computed(() => {
        return isDisplayAside.value ? '350px' : '70px'
    })

    // @returns
    return {
        routerLinks,
        profile,
        avatarSrc,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        asideWidth,
        handleResizeAside,
        minWidth,
        maxWidth
    }
}