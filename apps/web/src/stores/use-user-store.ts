import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { defineStore } from 'pinia'
import {
    signin,
    signup,
    checkin,
    signout,
    updateNickname,
    updatePassword,
    updateAvatar
} from '@nao-todo/apis'
import { throttle } from '@nao-todo/utils'
import getJWTPayload from '@nao-todo/utils/get-jwt-payload'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { User, SigninOptions, SignupOptions, ResponseData } from '@nao-todo/types'

export const useUserStore = defineStore('userStore', () => {
    const router = useRouter()

    const user = ref<User>()
    const token = ref<string>()
    const isAuthenticated = ref(false)

    const doSignin = async (options: SigninOptions) => {
        const result = await signin(options)
        if (result.code !== 20000) {
            NueMessage.error('登录失败：' + result.message)
            return false
        }
        const jwt = (result.data as { token: string }).token
        localStorage.setItem('USER_JWT', jwt)
        user.value = getJWTPayload(jwt)
        token.value = jwt
        isAuthenticated.value = true
        NueMessage.success('登录成功')
        return true
    }

    const doSignup = async (options: SignupOptions) => {
        const result = await signup(options)
        if (result.code === 20000) {
            NueMessage.success('注册成功')
            return true
        } else {
            NueMessage.error('注册失败：' + result.message)
            return false
        }
    }

    const doCheckin = async () => {
        const jwt = localStorage.getItem('USER_JWT') || ''
        if (!jwt) return false
        const result = await checkin(jwt)
        if (result.code !== 20000) {
            localStorage.removeItem('USER_JWT')
            user.value = void 0
            token.value = void 0
            isAuthenticated.value = false
            NueMessage.error('凭据认证失败：' + result.message)
            return false
        }
        const newJWT = (result.data as { token: string }).token
        localStorage.setItem('USER_JWT', newJWT)
        user.value = getJWTPayload(newJWT)
        token.value = newJWT
        isAuthenticated.value = true
        return true
    }

    const removeUserData = () => {
        localStorage.removeItem('USER_JWT')
        localStorage.removeItem('tasks/lastRouteWhenLeave')
    }

    const checkout = async () => {
        user.value = void 0
        token.value = void 0
        isAuthenticated.value = false
        return true
    }

    const doCheckout = throttle(async (checkoutMsg: string) => {
        await checkout()
        await router.push('/auth/login')
        NueMessage.error(checkoutMsg)
        removeUserData()
        return true
    }, 4000)

    const doSignout = async () => {
        if (token.value) {
            const result = await signout(token.value)
            if (result.code !== 20000) return false
        }
        await checkout()
        return true
    }

    // 用户登出（带确认）
    const signOutWithConfirmation = async () => {
        try {
            const result = await NueConfirm({
                title: '退出登录',
                content: '你确定要退出登录吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () => await doSignout()
            })
            if (result) {
                NueMessage.success('退出登录成功')
                await router.push('/auth/login')
                removeUserData()
            } else {
                NueMessage.error('退出登录失败')
            }
            return result
        } catch (e) {
            console.log('[UserStore] signOutWithConfirmation:', e)
        }
        return false
    }

    // 更新昵称
    const doUpdateNickname = async (newNickname: string) => {
        const _nickname = newNickname.trim()
        const result = await updateNickname(_nickname)
        if (result.code === 20000) {
            if (user.value) user.value.nickname = _nickname
            NueMessage.success('更新昵称成功')
            return true
        }
        NueMessage.error('更新昵称失败')
        return false
    }

    // 更新密码
    const updatePasswordWithConfirmation = async (newPasswordRaw: string) => {
        try {
            const result = (await NueConfirm({
                title: '提交更新密码',
                content: '确定要更新密码吗？（更新成功后需要重新登录）',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () => await updatePassword(newPasswordRaw.trim())
            })) as ResponseData
            if (result.code === 20000) {
                NueMessage.success('更新密码成功')
                const signoutRes = await doSignout()
                if (signoutRes) await router.push('/auth/login')
                return true
            }
            NueMessage.error('更新密码失败')
            return false
        } catch (e) {
            console.warn('[UserStore] updatePasswordWithConfirmation:', e)
        }
    }

    // 更新用户头像链接
    const updateUserAvatar = async (avatar: File | undefined) => {
        if (!avatar || !user.value) return
        if (!['image/jpeg', 'image/png', 'image/gif'].includes(avatar.type)) {
            NueMessage.error('图片格式不正确')
            return
        }
        if (avatar.size > 2 * 1024 * 1024) {
            NueMessage.error('图片大小不能超过 2 M')
            return
        }
        try {
            const formData = new FormData()
            formData.append('avatar', avatar)
            const result = await updateAvatar(formData)
            const responseData = result.data as { url: string }
            if (result.code === 20000) {
                user.value.avatar = responseData.url
                // vo.avatar = responseData.url
                // userStore.updateUserAvatar(result.data.url)
                // avatarFileInputRef.value.value = ''
            }
            console.log(result)
            // const response = await fetch('http://localhost:3002/api/user/avatar', {
            //     method: 'POST',
            //     body: formData,
            //     headers: { Authorization: `Bearer ${userStore.token}` }
            // })
            // const req = await response.json()
            // if (req.code === 20000) {
            //     vo.avatar = req.data.url
            //     userStore.updateUserAvatar(req.data.url)
            //     avatarFileInputRef.value.value = ''
            // }
            return responseData.url || void 0
        } catch (e) {
            console.warn(e)
        }
    }

    return {
        user,
        token,
        isAuthenticated,
        doSignin,
        doSignup,
        doCheckin,
        doCheckout,
        doSignout,
        signOutWithConfirmation,
        doUpdateNickname,
        updatePasswordWithConfirmation,
        updateUserAvatar
    }
})
