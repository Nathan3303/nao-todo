import axios from 'axios'

const $axios = axios.create({
    baseURL: 'http://localhost:3002/api'
    // baseURL: 'https://nathan33.xyz:3002/api'
})

export default $axios