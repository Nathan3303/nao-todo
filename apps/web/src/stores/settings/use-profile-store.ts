import { computed, reactive } from 'vue'
import { useUserStoreV2 } from '@/stores/global'
import { defineStore, storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError, useMoment } from '@nao-todo/utils'

type SettingsProfileVO = {
    id?: string
    avatar?: string
    nickname?: string
    newNickname?: string
    email?: string
    userId?: string
    createdAt?: string
    loading: {
        nickname: boolean
        avatar: boolean
    }
}

const useProfileStore = defineStore('SettingsProfileStore', () => {
    // @stores 全局 stores
    const userStore = useUserStoreV2()
    const router = useRouter()

    // @state 用户信息
    const { user } = storeToRefs(userStore)

    // @state 视图状态
    const vo = reactive<SettingsProfileVO>({
        id: user.value?.id,
        avatar: user.value?.avatar,
        nickname: user.value?.nickname,
        newNickname: user.value?.nickname,
        email: user.value?.email,
        userId: user.value?.id,
        createdAt: useMoment(user.value?.createdAt).format('YYYY年MM月DD日 HH时mm分'),
        loading: {
            nickname: false,
            avatar: false
        }
    })

    // @computed 名称是否有变更
    const isNicknameChanged = computed(() => vo.nickname !== vo.newNickname)

    // @method 退出登录
    const handleSignout = async () => {
        NueConfirm({
            title: '退出登录',
            content: '确定退出登录吗?',
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            onConfirm: async () => {
                const [res, err] = await userStore.signout()
                if (err) {
                    NueMessage.error(unwrapError(err))
                    return
                }
                await router.push({ path: '/auth/signin' })
                NueMessage.success('登出成功')
                return res
            }
        })
    }

    // @method 更新用户昵称
    const handleUpdateNickname = async () => {
        if (!vo.newNickname) return
        vo.loading.nickname = true
        const [res, err] = await userStore.updateNickname(vo.newNickname)
        vo.loading.nickname = false
        if (err != null) {
            NueMessage.error(unwrapError(err))
            return false
        }
        NueMessage.success('用户昵称修改成功')
        vo.nickname = vo.newNickname
        return res
    }

    // @method 更新用户头像
    const handleUpdateAvatar = async (avatar: File | undefined) => {
        if (!avatar) return
        // try {
        //     vo.loading.avatar = true
        //     const result = await userStore.updateAvatar(avatar)
        //     if (result) vo.avatar = result + '?t=' + Date.now()
        // } catch (e) {
        //     console.warn('[SettingsProfile] handleAvatarFileInputChange error:', e)
        // } finally {
        //     vo.loading.avatar = false
        // }
    }

    return {
        profileVO: vo,
        isNicknameChanged,
        handleSignout,
        handleUpdateNickname,
        handleUpdateAvatar
    }
})

export default useProfileStore

