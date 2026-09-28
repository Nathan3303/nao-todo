// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { messages } from '@nao-todo/shared/locales'
import { FIELD_LABEL_KEYS, fieldLabel, humanizeField } from '../conflict-field-labels'

/**
 * T340 —— 冲突字段名 → 用户可读标签（C 端化：不裸露技术键名）
 * 覆盖：已知字段映射到 i18n 标签 · 未映射字段可读回退（拆词 + 首字母大写）· 覆盖抽样。
 */

const anyLocale = (key: 'field.name' | 'field.archivedAt' | 'field.updatedAt'): string[] => [
    messages['zh-CN'][`sync.conflict.${key}`],
    messages['en-US'][`sync.conflict.${key}`]
]

describe('T340 conflict-field-labels', () => {
    it('已知字段 ⇒ i18n 可读标签（不裸露技术键名）', () => {
        expect(FIELD_LABEL_KEYS.name).toBe('sync.conflict.field.name')
        expect(FIELD_LABEL_KEYS.archivedAt).toBe('sync.conflict.field.archivedAt')
        expect(anyLocale('field.name')).toContain(fieldLabel('name'))
        expect(anyLocale('field.archivedAt')).toContain(fieldLabel('archivedAt'))
        expect(fieldLabel('updatedAt')).not.toBe('updatedAt')
        expect(fieldLabel('revision')).not.toBe('revision')
    })

    it('未映射字段 ⇒ 可读回退（拆词 + 首字母大写，非 raw camelCase）', () => {
        expect(humanizeField('someNewField')).toBe('Some New Field')
        expect(humanizeField('foo_bar')).toBe('Foo bar')
        expect(fieldLabel('totallyUnknownField')).toBe('Totally Unknown Field')
        expect(fieldLabel('totallyUnknownField')).not.toBe('totallyUnknownField')
    })

    it('业务字段覆盖抽样（映射存在）', () => {
        for (const field of [
            'name',
            'state',
            'priority',
            'tags',
            'parentTaskId',
            'isDone',
            'content',
            'duration',
            'note'
        ]) {
            expect(FIELD_LABEL_KEYS[field], field).toBeTruthy()
        }
    })
})