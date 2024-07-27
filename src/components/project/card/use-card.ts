import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NueMessage, NueConfirm } from 'nue-ui'
import type { ProjectCardProps, ProjectCardEmits } from './types'

export const useProjectCard = (props: ProjectCardProps, emit: ProjectCardEmits) => {
    const router = useRouter()

    const handleClick = () => {
        const { project, allowRoute } = props
        if (allowRoute) {
            router.push({
                name: 'project-main',
                params: {
                    projectId: props.project.id
                }
            })
        }
        emit('click', project)
    }

    return {
        handleClick
    }
}
