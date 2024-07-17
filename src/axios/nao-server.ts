import axios from 'axios'

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api'
    // baseURL: 'https://nathan33.xyz:3000/api',
})

export default axiosInstance