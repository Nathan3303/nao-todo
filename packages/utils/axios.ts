import axios from 'axios'
import { NueMessage } from 'nue-ui'
import { useUserStore } from '@/stores'

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3002/api' // Base URL in development mode
    // baseURL: 'https://nathan33.xyz:3002/api' // Base URL in production mode
})

// Add token to request header
axiosInstance.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${useUserStore().token || ''}`
    return config
})

// Handle response errors
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
)

export default axiosInstance
