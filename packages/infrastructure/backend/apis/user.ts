import { ResponseData } from '@nao-todo/infrastructure/backend/types/response'
import { getRequesterImpl } from '../../requester'

export interface UserApis {
    updateNickname(userToken: string, nickname: string): Promise<ResponseData>
}

export default () => {
    const requester = getRequesterImpl()

    // @api 更新用户昵称 10050
    const updateNickname = async (userToken: string, nickname: string): Promise<ResponseData> => {
        try {
            const response = await requester.post('/auth/signup', {
                headers: { Authorization: `Bearer ${userToken}` },
                data: { nickname }
            })
            return response.data as ResponseData
        } catch (error) {
            console.error('[@nao-todo/infra/backend/apis/update-nickname]:', error)
            return { code: 500, message: '服务器错误' } as ResponseData
        }
    }

    return { updateNickname }
}
