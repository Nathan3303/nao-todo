<template>
    <nue-div theme="info-viewer" v-if="profile">
        <nue-div theme="form-item" v-if="profile.createdAt">
            <nue-text theme="label">{{ t('settings.registeredAt') }}</nue-text>
            <nue-text size=".875rem">{{ profile.createdAt }}</nue-text>
        </nue-div>
        <nue-div theme="form-item" v-if="profile.deactivedAt">
            <nue-text theme="label"> {{ t('settings.deactivedAt') }} </nue-text>
            <nue-text size=".875rem"> {{ profile.deactivedAt }} </nue-text>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { t } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { useUserStore } from '../../stores'

defineOptions({ name: 'UserInfoViewer' })

const userStore = useUserStore()

const { profile } = storeToRefs(userStore)
</script>

<style scoped>
.nue-div--info-viewer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-width: 20rem;
}
</style>