import StateInfo from './state-info.vue'
import PriorityInfo from './priority-info.vue'
import DateInfo from './date-info.vue'
import BasicInfo from './basic-info.vue'
import CheckButton from './check-button.vue'
import DateSelector from './date-selector.vue'
import DeleteButton from './delete-button.vue'
import ProjectSelector from './project-selector.vue'
import Selector from './selector.vue'
import TagBar from './tag-bar.vue'

export const TodoStateInfo = StateInfo
export const TodoPriorityInfo = PriorityInfo
export const TodoDateInfo = DateInfo
export const TodoBasicInfo = BasicInfo
export const TodoCheckButton = CheckButton
export const TodoDateSelector = DateSelector
export const TodoDeleteButton = DeleteButton
export const TodoProjectSelector = ProjectSelector
export const TodoSelector = Selector
export const TodoTagBar = TagBar

export const TodoStateSelectOptions = [
    { label: '代办', value: 'todo', icon: 'circle' },
    { label: '正在进行', value: 'in-progress', icon: 'in-progress' },
    { label: '已完成', value: 'done', icon: 'success' }
    // { label: '搁置', value: 'suspended', icon: 'suspended' }
]

export const TodoPrioritySelectOptions = [
    { label: '低优先级', value: 'low', icon: 'priority-1' },
    { label: '中优先级', value: 'medium', icon: 'priority-2' },
    { label: '高优先级', value: 'high', icon: 'priority-3' },
    { label: '紧急', value: 'urgent', icon: 'urgent' }
]

