import axios from 'axios'

const $axios = axios.create({
    baseURL: 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

export default $axios
