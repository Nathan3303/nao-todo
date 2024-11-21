import axios from 'axios'
import { useUserStore } from '@nao-todo/webapp/src/stores'

const axiosInstance = axios.create({
    baseURL: 'https://nathan33.xyz:3002/api'
    // baseURL: 'http://localhost:3002/api'
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
