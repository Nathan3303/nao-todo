import axios from 'axios'
import { NueMessage } from 'nue-ui'
import { useUserStore } from '@/stores'

const axiosInstance = axios.create({
    // baseURL: 'http://localhost:3002/api'
    baseURL: 'https://nathan33.xyz:3002/api'
})

axiosInstance.interceptors.request.use((config) => {
    const userStore = useUserStore()
    if (userStore.token) {
        config.headers.Authorization = `Bearer ${userStore.token}`
    }
    return config
})

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        NueMessage.error(error)
        return Promise.reject(error)
    }
)

export default axiosInstance
