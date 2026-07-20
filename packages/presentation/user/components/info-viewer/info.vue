<template>
    <nue-div v-if="profile">
        <nue-text color="gray" size=".875rem">
            {{ t('settings.registeredAt') }}
        </nue-text>
        <nue-text size=".875rem">
            {{ profile.createdAt }}
        </nue-text>
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
