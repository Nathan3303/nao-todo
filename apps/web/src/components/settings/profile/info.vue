<template>
    <nue-container>
        <nue-header>{{ t('settings.moreInfo') }}</nue-header>
        <nue-main>
            <nue-content v-if="profile">
                <nue-div vertical gap=".5rem">
                    <nue-div class="settings-view__form-row">
                        <nue-text color="gray" size=".875rem">{{ t('settings.registeredAt') }}</nue-text>
                        <nue-text size=".875rem">
                            {{ profile.createdAt }}
                        </nue-text>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'SettingsProfileInfo' })

const userStore = useUserStore()

const { profile } = storeToRefs(userStore)
</script>

<style scoped>
.nue-container {
    > .nue-header,
    > .nue-main {
        height: auto;
        padding: 0.875rem 0;
    }
}
</style>

