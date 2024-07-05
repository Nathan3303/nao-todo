import axios from 'axios'
import { NueMessage } from 'nue-ui'

const $axios = axios.create({
    baseURL: 'http://localhost:3002/api'
    // baseURL: 'https://nathan33.xyz:3002/api'
})

$axios.interceptors.response.use(
    (response) => response,
    (error) => {
        NueMessage.error(error);
        return Promise.reject(error);
    }
)

export default $axios
