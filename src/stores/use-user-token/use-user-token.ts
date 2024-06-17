import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, InnerUserAccount, SubmitPayload } from './types'
import md5 from 'md5'

const innerUserAccount: InnerUserAccount = {
    email: 'lee1928@outlook.com',
    password: 'e32780235eb067f7153161884af764ca',
    name: 'Nathan'
}

export const useUserStore = defineStore('userStore', () => {
    const user = ref<User>()
    const token = ref<string>()

    function login(payload: SubmitPayload) {
        return new Promise<boolean>((resolve, reject) => {
            const { email, password } = payload
            if (email === '' || password === '') {
                reject(false)
                return
            }
            setTimeout(() => {
                if (
                    email === innerUserAccount.email &&
                    md5(password) === innerUserAccount.password
                ) {
                    user.value = innerUserAccount
                    token.value = 'fake-token'
                    resolve(true)
                } else {
                    reject(false)
                }
            }, 1000)
        })
    }

    function signup(payload: SubmitPayload) {
        return new Promise<boolean>((resolve, reject) => {
            const { email, password } = payload
            if (email === '' || password === '') {
                reject(false)
                return
            }
            setTimeout(() => resolve(true), 1000)
        })
    }

    return { user, token, login, signup }
})
