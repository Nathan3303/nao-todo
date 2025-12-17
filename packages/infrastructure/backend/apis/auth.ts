import type { SignInReq } from '@nao-todo/infrastructure/backend/types/auth'
import type { ResponseData } from '@nao-todo/infrastructure/backend/types/response'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'

export interface AuthApis {
    signIn: (signInReq: SignInReq) => Promise<ResponseData>
    signUp: (signUpReq: SignInReq) => Promise<ResponseData>
    checkIn: (jwt: string) => Promise<ResponseData>
    signOut: (jwt: string) => Promise<ResponseData>
}

export default () => {
    const requester = getRequesterImpl()

    // @api 注册 10000
    const signUp = async (signUpReq: SignInReq) => {
        try {
            const response = await requester.post('/auth/signup', signUpReq)
            return response.data as ResponseData
        } catch (error) {
            console.error('[@nao-todo/apis/sign-up-v2]:', error)
            return { code: 500, message: '服务器错误' } as ResponseData
        }
    }

    // @api 登录 10010
    const signIn = async (signInReq: SignInReq) => {
        try {
            const response = await requester.post('/auth/signin', signInReq)
            return response.data as ResponseData
        } catch (error) {
            console.error('[@nao-todo/apis/sign-in-v2]:', error)
            return { code: 500, message: '服务器错误' } as ResponseData
        }
    }

    // @api 检入 10020
    const checkIn = async (jwt: string) => {
        try {
            const response = await requester.put('/auth/checkin', { jwt })
            return response.data as ResponseData
        } catch (error) {
            console.error('[@nao-todo/apis/check-in-v2]:', error)
            return { code: 500, message: '服务器错误' } as ResponseData
        }
    }

    // @api 登出 10030
    const signOut = async (jwt: string) => {
        try {
            const response = await requester.put('/auth/signout', { jwt })
            return response.data as ResponseData
        } catch (error) {
            console.error('[@nao-todo/apis/sign-out-v2]:', error)
            return { code: 500, message: '服务器错误' } as ResponseData
        }
    }

    // @returns
    return { signUp, signIn, checkIn, signOut }
}
