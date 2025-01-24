<template>
    <Teleport
        v-if="mounted"
        to="#platform-sidenav"
    >
        <SideNavigation>
            <template #options>
                <a @click="$router.back()">
                    <nav-item
                        :icon="icons.chevronLeft"
                        label="Back"
                    />
                </a>
            </template>
        </SideNavigation>
    </Teleport>
    <ff-loading
        v-if="loading"
        message="Creating Pipeline..."
    />
    <form
        v-else
        class="space-y-6"
        @submit.prevent="create"
    >
        <SectionTopMenu
            :hero="'Create DevOps Pipeline'"
        />

        <div class="px-4 space-y-6">
            <!-- Form Description -->
            <div class="mb-6 text-sm text-gray-500">
                Create a DevOps Pipeline for linking Node-RED Instances together.
            </div>

            <!-- Pipeline Options -->
            <FormRow
                v-model="input.name"
                type="text"
                data-form="pipeline-name"
            >
                <template #default>
                    Pipeline name
                </template>
            </FormRow>

            <div class="flex flex-wrap gap-3 items-center">
                <ff-button
                    class="ff-btn--secondary"
                    @click="$router.back()"
                >
                    Cancel
                </ff-button>

                <ff-button
                    :disabled="!submitEnabled"
                    :data-action="'create-pipeline'"
                    type="submit"
                >
                    Create Pipeline
                </ff-button>
            </div>
        </div>
    </form>
</template>

<script>
import { ChevronLeftIcon } from '@heroicons/vue/solid'

import ApplicationsAPI from '../../../api/application.js'
import FormRow from '../../../components/FormRow.vue'
import NavItem from '../../../components/NavItem.vue'
import SectionTopMenu from '../../../components/SectionTopMenu.vue'
import SideNavigation from '../../../components/SideNavigation.vue'
import Alerts from '../../../services/alerts.js'

export default {
    name: 'CreatePipeline',
    components: {
        SideNavigation,
        SectionTopMenu,
        NavItem,
        FormRow
    },
    inheritAttrs: false,
    props: {
        application: {
            type: Object,
            required: true
        }
    },
    data () {
        return {
            icons: {
                chevronLeft: ChevronLeftIcon
            },
            mounted: false,
            loading: false,
            input: {
                name: null
            }
        }
    },
    computed: {
        submitEnabled () {
            return this.input.name?.length > 0
        }
    },
    async mounted () {
        this.mounted = true
    },
    methods: {
        async create () {
            this.loading = true
            try {
                await ApplicationsAPI.createPipeline(this.application.id, this.input.name)
                Alerts.emit('Pipeline successfully created.', 'confirmation')

                this.$router.push({
                    name: 'ApplicationPipelines',
                    params: {
                        id: this.application.id
                    }
                })
            } catch (error) {
                Alerts.emit('Failed to create Pipeline.', 'warning')
            }

            this.loading = false
        }
    }
}
</script>
