import { unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, reactive } from 'vue'
import { useProjectsStore } from '../../../stores'
import type { ProjectUpdaterDialogProps } from './types'

const useProjectUpdater = (props: ProjectUpdaterDialogProps) => {
    const projectsStore = useProjectsStore()

    const states = reactive({
        projectId: null as string | null,
        icon: 'more2',
        name: '',
        description: '',
        updating: false,
        disabled: false
    })

    const formData = computed({
        get: () => ({
            icon: states.icon,
            name: states.name,
            description: states.description
        }),
        set: (val) => {
            states.icon = val.icon
            states.name = val.name
            states.description = val.description
        }
    })

    const getProject = (id: string) => {
        const project = projectsStore.getProject(id)
        if (!project) {
            NueMessage.error('未找到清单')
            return false
        }
        states.projectId = id
        states.name = project.name || ''
        states.description = project.description || ''
        states.updating = false
        states.disabled = false
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
        const err = await props.projectUseCase.update(states.projectId, {
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
        // resetStates()
        return true
    }

    const resetStates = () => {
        states.projectId = null
        states.name = ''
        states.description = ''
        states.updating = false
        states.disabled = false
    }

    return { states, formData, getProject, updateProject, resetStates }
}

export default useProjectUpdater