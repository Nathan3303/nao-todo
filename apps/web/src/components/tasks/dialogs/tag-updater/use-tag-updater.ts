import { reactive, computed } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagUpdaterProps, TagUpdaterVO } from './types'

const useTagUpdater = (props: TagUpdaterProps) => {
    const states = reactive<TagUpdaterVO>({
        tagId: null,
        name: '',
        description: '',
        color: 'transparent',
        updating: false,
        disabled: false
    })

    const formData = computed({
        get: () => ({ name: states.name, description: states.description }),
        set: (val) => {
            states.name = val.name
            states.description = val.description
        }
    })

    const getTag = (id: string) => {
        const tag = props.tagGetter(id)
        if (!tag) {
            NueMessage.error('未找到标签')
            return false
        }
        states.tagId = id
        states.name = tag.name || ''
        states.description = tag.description || ''
        states.color = tag.color || 'transparent'
        return true
    }

    const updateTag = async (): Promise<boolean> => {
        if (!states.tagId) {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        if (!states.name) {
            NueMessage.error('标签名称不能为空')
            return false
        }
        states.disabled = states.updating = true
        const err = await props.updater(states.tagId, {
            name: states.name,
            description: states.description,
            color: states.color
        })
        states.updating = false
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            states.disabled = false
            return false
        }
        NueMessage.success('标签修改成功')
        states.tagId = null
        states.name = ''
        states.description = ''
        states.color = 'transparent'
        states.disabled = false
        return true
    }

    return {
        states,
        formData,
        getTag,
        updateTag
    }
}

export default useTagUpdater
