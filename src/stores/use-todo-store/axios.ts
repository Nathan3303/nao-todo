import axios from 'axios'

const $axios = axios.create({
    baseURL: 'http://8.222.190.33:3002/api'
})

export default $axios