import { inject, reactive, computed } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useProjectsStore } from '@/stores'
import { storeToRefs } from 'pinia'

const useProjectUpdater = () => {
    const { projectUseCase, dialogManager } = inject(INDEX_VIEW_CONTEXT_KEY)!
    const { projects } = storeToRefs(useProjectsStore())

    const states = reactive({
        projectId: null as string | null,
        name: '',
        description: '',
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

    const getProject = (id: string) => {
        const project = projects.value.find((p) => p.id === id)
        if (!project) {
            NueMessage.error('未找到清单')
            return false
        }
        states.projectId = id
        states.name = project.name || ''
        states.description = project.description || ''
        return true
    }

    const updateProject = async (): Promise<boolean> => {
        if (!states.projectId) {
            NueMessage.error('清单 ID 不能为空')
            return false
        }
        if (!states.name) {
            NueMessage.error('清单名称不能为空')
            return false
        }
        states.disabled = states.updating = true
        const err = await projectUseCase.update({
            id: states.projectId,
            icon: 'more2',
            name: states.name,
            description: states.description
        })
        states.updating = false
        if (err !== null) {
            NueMessage.error('清单更新失败：' + unwrapError(err))
            states.disabled = false
            return false
        }
        NueMessage.success('清单修改成功')
        states.projectId = null
        states.name = ''
        states.description = ''
        states.disabled = false
        return true
    }

    return { states, formData, dialogManager, getProject, updateProject }
}

export default useProjectUpdater



