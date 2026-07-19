<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import { UserAvatarUpdater, UserInfoViewer, UserNicknameUpdater } from '@nao-todo/domain/user'
import { t } from '@nao-todo/shared'
import { inject } from 'vue'

defineOptions({ name: 'SettingsProfileUpdater' })

const { isDisplayAside, switchDisplayAside, userUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.profile') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 2rem 1rem">
                    <user-avatar-updater :user-use-case="userUseCase" />
                    <user-nickname-updater :user-use-case="userUseCase" />
                    <user-info-viewer />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
