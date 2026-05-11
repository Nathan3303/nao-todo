import { ref, computed } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagUpdaterProps, TagUpdaterVO } from './types'

const useTagUpdater = (props: TagUpdaterProps) => {
    const states = ref<TagUpdaterVO>({
        tagId: null,
        name: '',
        description: '',
        color: 'transparent',
        updating: false,
        disabled: false
    })

    const formData = computed({
        get: () => ({ name: states.value.name, description: states.value.description }),
        set: (val) => {
            states.value.name = val.name
            states.value.description = val.description
        }
    })

    const getTag = (id: string) => {
        const tag = props.tagGetter(id)
        if (!tag) {
            NueMessage.error('未找到标签')
            return false
        }
        states.value.tagId = id
        states.value.name = tag.name || ''
        states.value.description = tag.description || ''
        states.value.color = tag.color || 'transparent'
        return true
    }

    const updateTag = async (): Promise<boolean> => {
        if (!states.value.tagId) {
            NueMessage.error('标签 ID 不能为空')
            return false
        }
        if (!states.value.name) {
            NueMessage.error('标签名称不能为空')
            return false
        }
        states.value.disabled = states.value.updating = true
        const err = await props.updater(states.value.tagId, {
            name: states.value.name,
            description: states.value.description,
            color: states.value.color
        })
        states.value.updating = false
        if (err !== null) {
            NueMessage.error(unwrapError(err))
            states.value.disabled = false
            return false
        }
        NueMessage.success('标签修改成功')
        states.value.tagId = null
        states.value.name = ''
        states.value.description = ''
        states.value.color = 'transparent'
        states.value.disabled = false
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
