import type { Requester, UseRequesterOptions, RequesterOpRtn } from './types'
import useAxiosRequester from './axios'

const emptyRequester: Requester = {
    _instance: null,
    name: '',
    baseURL: '',
    get: () => Promise.resolve({} as RequesterOpRtn),
    post: () => Promise.resolve({} as RequesterOpRtn),
    put: () => Promise.resolve({} as RequesterOpRtn),
    delete: () => Promise.resolve({} as RequesterOpRtn)
}

let requester: Requester = emptyRequester

export const getRequesterImpl = () => requester

export const initRequester = (options: UseRequesterOptions) => {
    const { name, baseURL } = options

    switch (name) {
        case 'AxiosRequester':
        default: {
            requester = useAxiosRequester(baseURL)
            break
        }
    }

    return requester
}

export type { Requester } from './types'
