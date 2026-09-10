import { APP_CONTEXT_KEY } from '@/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useUserStore } from '@nao-todo/presentation-identity'
import { readCachedNickname } from '@nao-todo/infrastructure'
import { getAvatarSrc, t } from '@nao-todo/shared'
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

    // @computed 离线身份降级（SHELL-03 C-05/C-18：profile 缺失不阻塞壳，身份仅为装饰）
    // 昵称优先级：在线 profile → 离线缓存（解锁前可读、userId 校验）→ 空（图标占位）
    const displayNickname = computed(() => profile.value?.nickname ?? readCachedNickname() ?? '')
    const isOfflineIdentity = computed(() => !profile.value?.nickname)
    /** 可访问名（轨道 70px 不放可见小字，改由 title + aria-label 承载；C-18 末条） */
    const identityLabel = computed(() => {
        const name = displayNickname.value
        if (!name) return ''
        return isOfflineIdentity.value ? t('identity.offlineName', { name }) : name
    })

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
        displayNickname,
        isOfflineIdentity,
        identityLabel,
        isDisplayAside,
        isUseFloatAside,
        switchDisplayAside,
        asideWidth,
        handleResizeAside,
        minWidth,
        maxWidth
    }
}