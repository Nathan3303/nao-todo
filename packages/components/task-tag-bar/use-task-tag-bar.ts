import { computed, ref, watch } from 'vue'
import type { TaskTagBarEmits, TaskTagBarProps } from './types'
import type { ComboBoxOption } from '../combo-box/types'
import type { TagViewObject } from '@nao-todo/usecases/tag'

export const useTaskTagBar = (props: TaskTagBarProps, emit: TaskTagBarEmits) => {
    /**
     * @ref 任务标签栏标签
     * @description 用于展示已选择的任务标签
     */
    const selectedTags = ref<TagViewObject[]>([])

    /**
     * @ref 任务标签栏选择器选项列表
     * @description 用于展示任务标签栏的选项列表
     */
    const comboBoxOptions = ref<ComboBoxOption[]>([])

    /**
     * @computed 任务标签栏样式计算
     * @description 用于计算任务标签栏的样式
     */
    const styles = computed(() => {
        return {
            '--tag-bar-transform-origin': props.transformOrigin || 'top left'
        }
    })

    /**
     * @computed 判断是否搜索为空
     * @description 判断当前是否处于搜索状态，且搜索结果为空，为空则显示新增标签的按钮
     */
    const isSearchEmpty = computed(() => {
        // 若有可用标签，且搜索结果为空，则认为搜索为空
        return props.availableTags.length && comboBoxOptions.value.length === 0
    })

    /**
     * 处理添加任务标签
     * @param tagId 任务标签ID
     * @param checked 是否选中任务标签
     */
    const pushTagHandler = async (tagId: unknown, { checked }: Partial<ComboBoxOption>) => {
        if (!checked) {
            await dropTagHandler(tagId as string)
            return
        }
        const taskTags = props.taskTagIds
        const newTags = taskTags.filter((id) => id !== (tagId as string))
        newTags.push(tagId as string)
        emit('updateTags', newTags)
    }

    /**
     * 处理删除任务标签
     * @param tagId 任务标签ID
     */
    const dropTagHandler = async (tagId: string) => {
        const taskTags = props.taskTagIds || []
        const newTags = taskTags.filter((id) => id !== tagId)
        emit('updateTags', newTags as string[])
    }

    /**
     * 处理创建任务标签
     * @param newTagName 新标签名称
     */
    const createTagHandler = (newTagName: string) => {
        if (props.readonly) return
        emit('createTag', newTagName)
    }

    /**
     * @watch 监听可用标签列表和任务标签ID列表变化
     * @description 当可用标签列表或任务标签ID列表变化时，更新选择器选项列表和已选择的任务标签列表
     */
    watch(
        () => [props.availableTags, props.taskTagIds],
        () => {
            // 初始化选择器选项列表和已选择的任务标签列表
            const { availableTags, taskTagIds, clamped } = props
            selectedTags.value = []
            comboBoxOptions.value = []
            // 若可用标签列表或任务标签ID列表为空，则直接返回
            if (!availableTags || !taskTagIds) {
                selectedTags.value = []
                comboBoxOptions.value = []
                return
            }
            // 遍历可用标签列表，更新选择器选项列表和已选择的任务标签列表
            for (const tag of availableTags) {
                // 若任务标签ID列表中包含当前标签ID，则认为已选中
                const isSelected = taskTagIds.indexOf(tag.id) !== -1
                // 添加选择器选项
                comboBoxOptions.value.push({
                    label: tag.name,
                    value: tag.id,
                    checked: isSelected
                })
                // 若当前标签未被选中，或者超出了溢出隐藏的范围，则跳过
                if (!isSelected || selectedTags.value.length >= clamped!) continue
                selectedTags.value.push(tag)
            }
        },
        { immediate: true, deep: true }
    )

    // @returns
    return {
        styles,
        comboBoxOptions,
        selectedTags,
        isSearchEmpty,
        pushTagHandler,
        dropTagHandler,
        createTagHandler
    }
}


