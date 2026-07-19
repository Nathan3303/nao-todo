<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import { UserPasswordUpdater } from '@nao-todo/domain/user'
import { t } from '@nao-todo/shared'
import { inject } from 'vue'

defineOptions({ name: 'SettingsPasswordUpdater' })

const { isDisplayAside, switchDisplayAside, authUseCase, userUseCase } =
    inject(SETTINGS_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="SettingsPasswordContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.password') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <user-password-updater
                        style="max-width: 32rem"
                        :user-use-case="userUseCase"
                        @sign-out="() => authUseCase.signOut()"
                    />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
