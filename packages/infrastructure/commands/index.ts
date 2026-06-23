export type {
    Modifier,
    Platform,
    KeyboardBinding,
    KeyEvent,
    ParsedKey,
    Command,
    ScopeState
} from './types'

export { CommandRegistry } from './registry'
export { ScopeManager } from './scope-manager'
export { parseKeys, matchesKeyEvent } from './matcher'
