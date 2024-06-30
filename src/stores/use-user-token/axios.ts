import axios from 'axios'

const $axios = axios.create({
    baseURL: 'https://nathan33.xyz:3000/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

export default $axios
