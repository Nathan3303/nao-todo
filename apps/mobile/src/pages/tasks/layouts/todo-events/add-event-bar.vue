<script lang="ts" setup>
import { ref } from 'vue'
import NuemIcon from '@/ui/icon.vue'

const inputValue = ref('')
</script>

<template>
    <view class="add-event-bar">
        <nuem-icon name="plus-circle" />
        <wd-input
            v-model="inputValue"
            class="add-event-bar__input"
            placeholder="输入检查事项内容..."
            custom-style="flex: auto"
        />
        <view class="add-event-bar__actions">
            <nuem-icon name="check" />
            <nuem-icon name="clear" />
        </view>
    </view>
</template>

<style scoped>
.add-event-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
}

.add-event-bar__input {
    flex: auto;
}

.add-event-bar__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: none;
    flex-wrap: nowrap;
}
</style>
