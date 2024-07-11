import { ref } from 'vue'

const isHide = ref(false)

export const useProjectAside = () => {
    const switchIsHide = () => {
        isHide.value = !isHide.value
    }

    return {
        isHide,
        switchIsHide
    }
}
