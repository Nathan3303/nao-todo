import axios from 'axios'

const $axios = axios.create({
    baseURL: 'https://nathan33.xyz:3002/api'
})

export default $axios