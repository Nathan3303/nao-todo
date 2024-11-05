import axios from 'axios'
import { NueMessage } from 'nue-ui'
import { useUserStore } from '@nao-todo/stores'

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3002/api' // Base URL in development mode
    // baseURL: 'https://nathan33.xyz:3002/api' // Base URL in production mode
})

// Add token to request header
axiosInstance.interceptors.request.use((config) => {
    const userStore = useUserStore()
    if (userStore.token) {
        config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
})

// Handle response errors
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        NueMessage.error('网络错误，请稍后再试')
        return Promise.reject(error)
    }
)

export default axiosInstance
