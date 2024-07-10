import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, SubmitPayload } from './types'
import md5 from 'md5'
import { NueMessage } from 'nue-ui'
import { naoServer as $axios } from '@/axios'

export const useUserStore = defineStore('userStore', () => {
    const user = ref<User>()
    const token = ref<string>()
    const isAuthenticated = ref(false)

    async function _saveToken(jwt: string) {
        token.value = jwt
        const jwtPayload = jwt.split('.')[1]
        const decodedPayload = JSON.parse(atob(jwtPayload))
        user.value = decodedPayload as User
        localStorage.setItem('jwt@user', jwt)
        isAuthenticated.value = true
    }

    async function _removeToken() {
        token.value = ''
        user.value = undefined
        isAuthenticated.value = false
        localStorage.removeItem('jwt@user')
        isAuthenticated.value = false
    }

    async function login(payload: SubmitPayload) {
        const { email, password } = payload
        const response = await $axios.post('/signin', {
            email: email.toLowerCase(),
            password: md5(password)
        })
        if (response.data.code === '20000') {
            const jwt = response.data.data
            _saveToken(jwt)
        }
        return response.data
    }

    async function signup(payload: SubmitPayload) {
        const { email, password } = payload
        const response = await $axios.post('/signup', {
            email: email.toLowerCase(),
            password: md5(password)
        })
        return response.data
    }

    async function isLoggedIn() {
        const jwt = localStorage.getItem('jwt@user')
        return !!jwt
    }

    async function checkin() {
        const jwt = localStorage.getItem('jwt@user')
        if (!jwt) {
            _removeToken()
            return null
        }
        const response = await $axios.get('/checkin' + `?jwt=${jwt}`)
        if (response.data.code === '20000') {
            _saveToken(response.data.data)
        } else {
            _removeToken()
            NueMessage.error(response.data.message)
        }
    }

    async function signout() {
        const jwt = token.value
        if (!jwt) {
            NueMessage.error('Sign in first')
            return
        }
        const response = await $axios.delete('/signout' + `?jwt=${jwt}`)
        if (response.data.code === '20000') {
            _removeToken()
            NueMessage.success('Logout successfully')
            return true
        } else {
            NueMessage.error(response.data.message)
        }
    }

    return { user, token, isAuthenticated, isLoggedIn, checkin, login, signup, signout }
})
