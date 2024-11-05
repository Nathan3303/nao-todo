<template>
    <empty :empty="!project">
        <nue-div vertical>
            <!-- <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> Id </nue-text>
                <nue-text size="14px"> {{ project?.id }} </nue-text>
            </nue-div> -->
            <nue-div vertical align="stretch" gap="4px" flex>
                <nue-text size="12px" color="gray"> 名称 </nue-text>
                <nue-text size="14px"> {{ project?.title }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="4px">
                <nue-text size="12px" color="gray"> 描述 </nue-text>
                <nue-text size="14px"> {{ project?.description || 'No description' }} </nue-text>
            </nue-div>
            <nue-div vertical align="stretch" gap="6px" flex>
                <nue-text size="12px" color="gray"> 创建者 </nue-text>
                <nue-div align="center" gap="6px">
                    <nue-avatar
                        src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                    ></nue-avatar>
                    <nue-text size="12px">Nathan</nue-text>
                </nue-div>
            </nue-div>
            <nue-div wrap="nowrap">
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> 创建于 </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="4px" flex>
                    <nue-text size="12px" color="gray"> 更新于 </nue-text>
                    <nue-text size="14px">
                        {{ moment(project?.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}
                    </nue-text>
                </nue-div>
            </nue-div>
        </nue-div>
    </empty>
</template>

<script setup lang="ts">
import type { ProjectDetailsProps } from './types'
import moment from 'moment'
import { Empty } from '@nao-todo/components/general'

defineOptions({ name: 'ProjectDetails' })
defineProps<ProjectDetailsProps>()
</script>

<style scoped></style>
