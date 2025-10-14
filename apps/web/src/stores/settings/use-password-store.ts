import { defineStore } from 'pinia'
import { useUserStoreV2 } from '@/stores/global'
import { computed, reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'

type SettingsPasswordVO = {
    oldPassword: string
    newPassword: string
    confirmNewPassword: string
    loading: boolean
}

const usePasswordStore = defineStore('SettingsPasswordStore', () => {
    const userStore = useUserStoreV2()

    const passwordVO = reactive<SettingsPasswordVO>({
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: '',
        loading: false
    })

    const submitButtonDisabled = computed(() => {
        return !passwordVO.oldPassword || !passwordVO.newPassword || !passwordVO.confirmNewPassword
    })

    const handleUpdatePassword = async () => {
        if (passwordVO.newPassword !== passwordVO.confirmNewPassword) {
            NueMessage.error('所输入的两次新密码不匹配')
            return
        }
        passwordVO.loading = true
        const [res, err] = await userStore.updatePassword(
            passwordVO.oldPassword,
            passwordVO.newPassword
        )
        passwordVO.loading = false
        if (err) {
            NueMessage.error(unwrapError(err))
            return
        }
        return res
    }

    return {
        passwordVO,
        submitButtonDisabled,
        handleUpdatePassword
    }
})

export default usePasswordStore
