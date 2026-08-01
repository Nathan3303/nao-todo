# Focus 计时器外环动画实现方案

## 需求分析

用户希望为 `/home/nathan/Projects/nao-todo/apps/web/src/components/pomodoro/focus/focus.vue` 组件增加一个正向计时的外环运行动画。

### 当前组件状态

| 属性             | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| `status`         | 状态：idle（空闲）/ running（运行中）/ paused（暂停） |
| `elapsedSeconds` | 累计已过去的秒数（正计时）                            |
| `taskName`       | 关联任务名称                                          |

### 设计要点

1. **正向计时特性**：与 timer.vue 的倒计时不同，focus.vue 是正计时，没有预设总时间
2. **动画需求**：在 running 状态时显示外环动画效果
3. **基于现有元素**：基于 `<nue-div theme="circle"></nue-div>` 或定义新元素
4. **技术方案**：用户要求使用 SVG 实现

---

## 实现方案

### 方案选择

采用 **SVG 环形进度条 + CSS 动画** 的方案：

1. 使用 SVG 的 `<circle>` 元素实现环形进度条
2. 使用 SVG 的 `stroke-dasharray` 和 `stroke-dashoffset` 实现进度动画
3. 在 running 状态时显示旋转动画效果
4. idle 和 paused 状态显示静态圆圈

### 技术实现

#### 1. 修改模板结构

替换现有 `<nue-div theme="circle">` 为 SVG 实现：

```vue
<nue-div theme="circle">
    <svg class="progress-ring" viewBox="0 0 100 100">
        <!-- 背景圆环 -->
        <circle
            class="progress-ring-bg"
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(200, 200, 200, 0.8)"
            stroke-width="4"
        />
        <!-- 进度圆环 -->
        <circle
            class="progress-ring-progress"
            :class="{ running: isRunning }"
            cx="50"
            cy="50"
            r="46"
            fill="none"
            :stroke="progressColor"
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray="289 289"
            transform="rotate(-90 50 50)"
        />
    </svg>
</nue-div>
```

#### 2. 动画逻辑

- **running 状态**：进度圆环持续旋转，表示时间流逝
- **idle/paused 状态**：只显示静态背景圆圈，进度圆环隐藏

#### 3. 计算属性

```typescript
const progressColor = computed(() => 'var(--nue-primary-color-900)')
```

#### 4. CSS 动画实现

```css
.progress-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

.progress-ring-progress {
    opacity: 0;
    transition: opacity 0.3s ease;
    will-change: transform;
}

.progress-ring-progress.running {
    opacity: 1;
    animation: spin 3s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
```

---

## 修改文件清单

| 文件路径                                           | 修改类型 | 说明                    |
| -------------------------------------------------- | -------- | ----------------------- |
| `apps/web/src/components/pomodoro/focus/focus.vue` | 修改     | 添加 SVG 动画元素和样式 |

---

## 步骤分解

1. **修改模板**：替换 `nue-div theme="circle"` 为 SVG 环形进度条
2. **添加计算属性**：添加 `progressColor` 计算属性
3. **编写 CSS**：实现 SVG 样式和旋转动画
4. **测试验证**：确保动画在 running 状态正常运行，其他状态隐藏

---

## 风险评估

| 风险       | 描述                     | 应对方案                         |
| ---------- | ------------------------ | -------------------------------- |
| SVG 兼容性 | 部分旧浏览器可能存在问题 | SVG 是标准特性，现代浏览器均支持 |
| 性能问题   | 持续动画可能影响性能     | 使用 `will-change` 优化          |
| 样式冲突   | 可能与现有样式冲突       | 使用独立的 CSS 类名              |

---

## 预期效果

- **idle 状态**：显示静态灰色背景圆圈，无进度动画
- **running 状态**：进度圆环持续旋转，显示正向计时进行中
- **paused 状态**：停止动画，只显示静态背景圆圈