import axios from 'axios'
import { useUserStore } from '@nao-todo/webapp/src/stores'

export const baseURL = 'https://nathan33.site:3002/api'
// export const baseURL = 'http://localhost:3002/api'

// Create Axios instance
const axiosInstance = axios.create({ baseURL })

// Add token to request header
axiosInstance.interceptors.request.use((config) => {
    config.headers.Authorization = `Bearer ${useUserStore().token || ''}`
    return config
})

// Handle response errors
axiosInstance.interceptors.response.use(
    async (response) => {
        switch (response.data.code) {
            case 40300:
                await useUserStore().doCheckout('用户凭证无效，请重新登录')
                break
        }
        return response
    },
    (error) => Promise.reject(error)
)

export default axiosInstance
