import md5 from 'md5'
import $axios from '@nao-todo/utils/axios'
import type { ResponseData, SigninOptions, SignupOptions } from '@nao-todo/types'

// 登录
export const signin = async (options: SigninOptions) => {
    try {
        const { email, password } = options
        const response = await $axios.post('/signin', {
            email: email.trim().toLowerCase(),
            password: md5(password)
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/signin]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 注册
export const signup = async (payload: SignupOptions) => {
    try {
        const { email, password, nickname } = payload
        const response = await $axios.post('/signup', {
            email: email.trim().toLowerCase(),
            password: md5(password),
            nickname: nickname ? nickname.trim() : undefined
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/signup]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 登记
export const checkin = async (jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await $axios.get(`/checkin?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/checkin]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 登出
export const signout = async (jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await $axios.delete(`/signout?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/signout]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 修改昵称
export const updateNickname = async (newNickname: string) => {
    try {
        const response = await $axios.post('/user/nickname', { nickname: newNickname })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/updateNickname]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 修改密码
export const updatePassword = async (newPasswordRaw: string, phoneNumber?: number) => {
    try {
        const response = await $axios.post('/user/password', { password: md5(newPasswordRaw) })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/updatePassword]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
