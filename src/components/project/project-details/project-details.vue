<template>
    <empty :empty="!project">
        <nue-div vertical>
            <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> Id </nue-text>
                <nue-text size="14px"> {{ project?.id }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> Name </nue-text>
                <nue-text size="14px"> {{ project?.name }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="4px">
                <nue-text size="12px" color="gray"> Description </nue-text>
                <nue-text size="14px"> {{ project?.description || 'No description' }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="6px" flex>
                <nue-text size="12px" color="gray"> Created by </nue-text>
                <nue-div align="center" gap="6px">
                    <nue-avatar
                        src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                    ></nue-avatar>
                    <nue-text size="12px">Nathan</nue-text>
                </nue-div>
            </nue-div>
            <nue-div wrap="nowrap">
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Created at </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.createAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> Updated at </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.updateAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
    </empty>
</template>

<script setup lang="ts">
import type { ProjectDetailsProps } from './types'
import moment from 'moment'
import { Empty } from '@/components/general'

defineOptions({ name: 'ProjectDetails' })
defineProps<ProjectDetailsProps>()
</script>

<style scoped></style>
