import type { Tag } from '@nao-todo/types'
import { reactive } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagColorUpdaterProps, TagColorUpdaterVO } from './types'

const useTagColorUpdater = (props: TagColorUpdaterProps) => {
    // @states
    const states = reactive<TagColorUpdaterVO>({
        tagId: null,
        color: 'transparent',
        updating: false,
        disabled: false
    })

    // @method 获取标签颜色
    const getTagColor = (id: Tag['id']) => {
        if (!id || id === '') {
            NueMessage.error('标签 ID 不能为空')
            return
        }
        states.tagId = id
        states.color = props.tagColorGetter(id) || 'transparent'
        console.log(props.tagColorGetter(id))
    }

    // @method 更新标签颜色
    const updateTagColor = async (): Promise<boolean> => {
        // 判断 tagId 是否为空
        if (!states.tagId || states.tagId === '') {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        // 调用 API
        states.disabled = states.updating = true
        const err = await props.tagColorUpdater(states.tagId, states.color)
        states.updating = false
        // 处理结果
        if (err) {
            NueMessage.error(unwrapError(err))
            states.disabled = false
            return false
        }
        NueMessage.success('标签颜色修改成功')
        states.tagId = null
        states.color = 'transparent'
        return true
    }

    // @returns
    return {
        states,
        getTagColor,
        updateTagColor
    }
}

export default useTagColorUpdater

