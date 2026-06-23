import type { SuggestionOption, InlineChipData } from './types'

export interface TriggerHandler {
  /** Trigger character (e.g., '#', '@', '!', '~') */
  character: string
  /** Chip type identifier (e.g., 'tag', 'project', 'priority', 'state') */
  type: string

  // ── Display ──

  /** Popover header text */
  headerLabel: string
  /** Label for "create new" button. Return null to suppress. */
  getCreateLabel?: (query: string) => string | null

  // ── Behavior ──

  /** true → selecting replaces previous (single-value); false → accumulates (multi-value) */
  isSingleValue: boolean
  /** Whether the "create new" action is available */
  canCreate: boolean

  // ── Data binding ──

  /** Key in TaskCreatorInputProps where the data source array lives */
  dataSourceKey: string
  /** Key in TaskCreatorInputValue where this handler reads/writes its value */
  valueKey: string
  /** Default value when the model resets (e.g. [] for multi, null for single) */
  defaultValue: any

  // ── Operations ──

  /** Given a query and the full data source array, return filtered SuggestionOption[] */
  getFilteredOptions(query: string, dataSource: any[]): SuggestionOption[]

  /**
   * Build the chip's outer `<span>` HTML string for use in rebuildContent / innerHTML.
   * Returns null if the entity cannot be found in dataSource.
   * The returned string must be a complete `<span class="vue-chip-mount" ...>` element.
   */
  buildChipHtmlString(entityId: string, chipId: string, dataSource: any[]): string | null

  /**
   * Build the DOM element that goes *inside* the `.vue-chip-mount` span.
   * Called at runtime when a chip is mounted after user selection.
   */
  buildChipContent(chipData: InlineChipData): HTMLElement

  /**
   * Extract the serialized value from a chip DOM element for model population.
   */
  extractChipValue(el: HTMLElement): string | null
}

export class TriggerRegistry {
  private byChar = new Map<string, TriggerHandler>()
  private byType = new Map<string, TriggerHandler>()

  register(handler: TriggerHandler): void {
    this.byChar.set(handler.character, handler)
    this.byType.set(handler.type, handler)
  }

  getByChar(char: string): TriggerHandler | undefined {
    return this.byChar.get(char)
  }

  getByType(type: string): TriggerHandler | undefined {
    return this.byType.get(type)
  }

  getAll(): TriggerHandler[] {
    return [...this.byType.values()]
  }
}

export const registry = new TriggerRegistry()
