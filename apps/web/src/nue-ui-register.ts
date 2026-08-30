import type { App } from 'vue'
import {
    NueAside,
    NueAvatar,
    NueBadge,
    NueButton,
    NueButtonGroup,
    NueCheckbox,
    NueCheckboxGroup,
    NueCollapse,
    NueCollapseItem,
    NueContainer,
    NueContent,
    NueDatePicker,
    NueDialog,
    NueDiv,
    NueDivider,
    NueDrawer,
    NueDropdown,
    NueDropdownItem,
    NueEmpty,
    NueFooter,
    NueHeader,
    NueIcon,
    NueInfiniteScroll,
    NueInput,
    NueLink,
    NueMain,
    NueProgress,
    NueScrollBar,
    NueSelect,
    NueSelectOption,
    NueSeparator,
    NueSwitch,
    NueText,
    NueTextarea,
    NueTooltip
} from 'nue-ui'

// 按需注册 NueUI 组件（仅模板实际使用的部分），替代全量 app.use(NueUI)。
// nue-ui 1.11.0 起 JS 为 side-effect-free 且无 mega-chunk，具名导入可被 rolldown
// tree-shake，未注册的组件不会进入打包产物。
// NueMessage/NueConfirm/NuePrompt 走 usePopupPool hook 自建容器，
// 代码中均为直接导入（import { NueMessage } from 'nue-ui'），无需全局注册。
const components = {
    NueAside,
    NueAvatar,
    NueBadge,
    NueButton,
    NueButtonGroup,
    NueCheckbox,
    NueCheckboxGroup,
    NueCollapse,
    NueCollapseItem,
    NueContainer,
    NueContent,
    NueDatePicker,
    NueDialog,
    NueDiv,
    NueDivider,
    NueDrawer,
    NueDropdown,
    NueDropdownItem,
    NueEmpty,
    NueFooter,
    NueHeader,
    NueIcon,
    NueInfiniteScroll,
    NueInput,
    NueLink,
    NueMain,
    NueProgress,
    NueScrollBar,
    NueSelect,
    NueSelectOption,
    NueSeparator,
    NueSwitch,
    NueText,
    NueTextarea,
    NueTooltip
}

/** 按需注册插件：替代 NueUI 全量 install */
export const nueUI = {
    install(app: App) {
        for (const [name, component] of Object.entries(components)) {
            app.component(name, component)
        }
    }
}