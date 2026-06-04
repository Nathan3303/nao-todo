# 相对日期解析方案优化计划

## 1. 现状分析

### 1.1 当前实现
- **位置**: [relative-date-parser.ts](file:///home/nathan/Development/nao-todo/packages/infrastructure/utils/relative-date-parser.ts)
- **功能**: 将日期转换为中文相对日期格式
- **输出示例**:
  - `今天, 14:30`
  - `昨天, 09:00`
  - `上周, 5月20日, 08:00`
  - `下周, 5月25日, 10:00`

### 1.2 优势
- 完全自定义，灵活控制输出格式
- 支持"上周"、"下周"等业务特定语义
- 无需额外插件依赖

### 1.3 局限性
- 只能处理有限的日期范围
- 无法处理"N分钟前"、"N小时前"等短时间相对表示
- 每次调用都需要遍历规则数组

## 2. 优化目标

保留现有方案的同时，新增 dayjs relativeTime 插件支持，形成两套方案：

### 方案 A: 自定义相对日期（现有）
**用途**: 需要精确控制输出格式的业务场景
**输出示例**: `今天, 14:30` | `昨天, 09:00` | `上周, 5月20日, 08:00`

### 方案 B: dayjs relativeTime 插件
**用途**: 需要快速实现"N分钟前"、"N小时前"等场景
**输出示例**: `2分钟前` | `3小时前` | `2天前`

## 3. 实施方案

### 3.1 目录结构优化

```
packages/infrastructure/utils/
├── date/
│   ├── index.ts                    # 统一导出
│   ├── relative-date-parser.ts     # 现有方案（重命名）
│   ├── relative-time.ts            # 新增：dayjs relativeTime 封装
│   └── types.ts                    # 新增：类型定义
```

### 3.2 新增文件清单

#### 3.2.1 `date/types.ts` - 类型定义
```typescript
import type { Go } from '@nao-todo/types'

export interface RelativeTimeOptions {
  withoutSuffix?: boolean
  threshold?: RelativeTimeThreshold
}

export interface RelativeTimeThreshold {
  thresholds?: Array<{
    l: string
    r: number
    d?: string
  }>
  rounding?: (num: number) => number
}

export type DateInput = string | dayjs.Dayjs | Date | number
```

#### 3.2.2 `date/relative-time.ts` - relativeTime 封装
```typescript
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.extend(updateLocale)

dayjs.updateLocale('zh-cn', {
  relativeTime: {
    future: '%s内',
    past: '%s前',
    s: '几秒',
    m: '1分钟',
    mm: '%d分钟',
    h: '1小时',
    hh: '%d小时',
    d: '1天',
    dd: '%d天',
    M: '1个月',
    MM: '%d个月',
    y: '1年',
    yy: '%d年'
  }
})

export const fromNow = (date: DateInput, withoutSuffix = false): string => {
  const d = dayjs(date)
  if (!d.isValid()) return '无效日期'
  return d.locale('zh-cn').fromNow(withoutSuffix)
}

export const toNow = (date: DateInput, withoutSuffix = false): string => {
  const d = dayjs(date)
  if (!d.isValid()) return '无效日期'
  return d.locale('zh-cn').toNow(withoutSuffix)
}

export const timeAgo = (date: DateInput): string => {
  const d = dayjs(date)
  if (!d.isValid()) return '无效日期'

  const now = dayjs()
  const diffInMinutes = now.diff(d, 'minute')
  const diffInHours = now.diff(d, 'hour')
  const diffInDays = now.diff(d, 'day')

  if (diffInMinutes < 1) return '刚刚'
  if (diffInMinutes < 60) return `${diffInMinutes}分钟前`
  if (diffInHours < 24) return `${diffInHours}小时前`
  if (diffInDays < 30) return `${diffInDays}天前`

  return d.format('YYYY-MM-DD HH:mm')
}
```

#### 3.2.3 `date/index.ts` - 统一导出
```typescript
export { default as parse2RelativeDate } from './relative-date-parser'
export { fromNow, toNow, timeAgo } from './relative-time'
```

## 4. 使用指南

### 4.1 场景选择

| 场景 | 推荐方案 | 示例输出 |
|------|---------|---------|
| 消息列表、评论时间 | dayjs relativeTime | `3分钟前` |
| 日程、任务截止日期 | 自定义相对日期 | `明天, 14:30` |
| 历史记录归档 | dayjs relativeTime | `2天前` |
| 会议预约、提醒 | 自定义相对日期 | `下周, 5月25日, 10:00` |

### 4.2 代码示例

```typescript
import { parse2RelativeDate, fromNow, timeAgo } from '@nao-todo/infrastructure/utils/date'

// 方案 A: 自定义相对日期（精确控制）
const schedule = parse2RelativeDate('2026-05-23 14:00')
// 输出: "明天, 14:00"

// 方案 B: dayjs relativeTime
const comment = fromNow('2026-05-22 10:30:00')
// 输出: "2小时前"

// 方案 B: 快速实现（带业务逻辑）
const message = timeAgo('2026-05-22 10:30:00')
// 输出: "2小时前"
```

## 5. 实施步骤

### 步骤 1: 创建类型定义
- [ ] 创建 `packages/infrastructure/utils/date/types.ts`
- [ ] 定义相关类型接口

### 步骤 2: 迁移现有代码
- [ ] 创建 `packages/infrastructure/utils/date/` 目录
- [ ] 移动 `relative-date-parser.ts` 到 `date/` 目录
- [ ] 更新 import 路径（如果需要）

### 步骤 3: 实现 relativeTime 封装
- [ ] 创建 `packages/infrastructure/utils/date/relative-time.ts`
- [ ] 配置中文语言包
- [ ] 实现 `fromNow()`, `toNow()`, `timeAgo()` 函数

### 步骤 4: 创建统一导出
- [ ] 创建 `packages/infrastructure/utils/date/index.ts`
- [ ] 导出所有日期相关函数

### 步骤 5: 更新引用
- [ ] 检查所有使用相对日期的组件
- [ ] 更新 import 路径（如有必要）
- [ ] 添加新方案的使用示例

### 步骤 6: 测试验证
- [ ] 运行现有测试确保无回归
- [ ] 手动测试新方案输出
- [ ] 检查边界情况（无效日期、极端时间等）

## 6. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| import 路径变更导致构建失败 | 高 | 保留旧文件作为别名，逐步迁移 |
| relativeTime 中文配置不生效 | 低 | 显式设置 `locale('zh-cn')` |
| 时区问题 | 中 | 使用 `dayjs.locale()` 确保一致性 |

## 7. 兼容性考虑

- **向后兼容**: 保持现有 `parse2RelativeDate` 函数签名不变
- **新增 API**: 新增函数使用独立命名，避免冲突
- **依赖管理**: relativeTime 和 updateLocale 为轻量插件，无显著体积增加

## 8. 后续优化建议

1. **性能优化**: 考虑缓存 `dayjs.updateLocale()` 调用结果
2. **可配置性**: 增加选项参数，支持自定义输出格式
3. **测试覆盖**: 编写单元测试覆盖边界情况
4. **文档完善**: 在组件库文档中添加使用示例

## 9. 预计工作量

- 类型定义和目录结构: 0.5 小时
- relativeTime 封装实现: 1 小时
- 统一导出和引用更新: 0.5 小时
- 测试和验证: 1 小时

**总计**: 约 3 小时

---

**文档版本**: v1.0
**创建日期**: 2026-05-22
**负责人**: [待定]
**状态**: 待评审
