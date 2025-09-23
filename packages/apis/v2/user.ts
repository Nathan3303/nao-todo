import sparkMD5 from 'spark-md5'
import type { Requester, ResponseData, SigninOptions, SignupOptions } from '@nao-todo/types'

export const signInApi = async (requester: Requester, options: SigninOptions) => {
    try {
        const { email, password } = options
        const response = await requester.post('/signin', {
            email: email.trim().toLowerCase(),
            password: sparkMD5.hash(password)
        })
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/sign-in-v2]:', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const signUpApi = async (requester: Requester, options: SignupOptions) => {
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
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const checkInApi = async (requester: Requester, jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await requester.put(`/checkin?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/check-in-v2]:', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const signOutApi = async (requester: Requester, jwt: string) => {
    try {
        // const jwt = localStorage.getItem('USER_JWT') || ''
        const response = await requester.delete(`/signout?jwt=${jwt}`)
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/sign-out-v2]:', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateNicknameApi = async (requester: Requester, newNickname: string) => {
    try {
        const response = await requester.put('/profile', { nickname: newNickname })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/update-nickname-v2]:', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updatePasswordApi = async (
    requester: Requester,
    oldPasswordRaw: string,
    newPasswordRaw: string
) => {
    try {
        const response = await requester.put('/password', {
            oldPassword: sparkMD5.hash(oldPasswordRaw),
            newPassword: sparkMD5.hash(newPasswordRaw)
        })
        return response.data as ResponseData
    } catch (error) {
        console.log('[@nao-todo/apis/update-password-v2]:', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
