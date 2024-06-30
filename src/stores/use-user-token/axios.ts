import axios from 'axios'

const $axios = axios.create({
    baseURL: 'http://8.222.190.33:3000/api',
    headers: {
        'Content-Type': 'application/json'
    }
})

export default $axios
