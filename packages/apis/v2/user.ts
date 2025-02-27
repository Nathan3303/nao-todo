import sparkMD5 from 'spark-md5'
import type { Requester, ResponseData, SigninOptions, SignupOptions } from '@nao-todo/types'

export const signInApiV2 = async (requester: Requester, options: SigninOptions) => {
    try {
        const { email, password } = options
        const response = await requester.post('/signin', {
            email: email.trim().toLowerCase(),
            password: sparkMD5.hash(password)
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/sign-in-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const signUpApiV2 = async (requester: Requester, options: SignupOptions) => {
    try {
        const { email, password, nickname } = options
        const response = await requester.post('/signup', {
            email: email.trim().toLowerCase(),
            password: sparkMD5.hash(password),
            nickname: nickname ? nickname.trim() : void 0
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/sign-up-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const checkInApiV2 = async (requester: Requester, jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await requester.get(`/checkin?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/check-in-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const signOutApiV2 = async (requester: Requester, jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await requester.get(`/signout?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/sign-out-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateNicknameV2 = async (requester: Requester, newNickname: string) => {
    try {
        const response = await requester.put('/user/nickname', { nickname: newNickname })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/update-nickname-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updatePasswordV2 = async (requester: Requester, newPasswordRaw: string) => {
    try {
        const response = await requester.put('/user/password', {
            password: sparkMD5.hash(newPasswordRaw)
        })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/update-password-v2]:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
