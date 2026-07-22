<script setup lang="ts">
import { t } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { useUserStore } from '../../stores'
import { computed } from 'vue'
import dayjs from 'dayjs'

defineOptions({ name: 'UserInfoViewer' })

const userStore = useUserStore()
const { profile } = storeToRefs(userStore)

const deletionDeadline = computed<string>(() => {
    const { deactivedAt } = profile.value
    if (!deactivedAt) return ''
    const deletionDay = dayjs(deactivedAt).add(7, 'days').format('YYYY-MM-DD HH:mm')
    return deletionDay
})
</script>

<template>
    <nue-div theme="info-viewer" v-if="profile">
        <nue-div theme="form-item" v-if="profile.createdAt">
            <nue-text theme="label">{{ t('settings.registeredAt') }}</nue-text>
            <nue-text size=".875rem">{{ profile.createdAt }}</nue-text>
        </nue-div>
        <nue-div theme="form-item" v-if="profile.deactivedAt">
            <nue-text theme="label">{{ t('settings.deactivedAt') }}</nue-text>
            <nue-text size=".875rem">{{ profile.deactivedAt }}</nue-text>
        </nue-div>
        <nue-div theme="form-item,deletion" v-if="deletionDeadline">
            <nue-text theme="label">数据删除执行时间</nue-text>
            <nue-text size=".875rem">{{ deletionDeadline }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--info-viewer {
    display: grid;
    grid-template-columns: repeat(auto-fit, 10rem);
}

.nue-div--deletion {
    font-weight: bold;
    color: var(--nue-error-color-50);

    .nue-text--label {
        color: var(--nue-error-color-50);
    }
}
</style>
