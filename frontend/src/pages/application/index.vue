<template>
    <Teleport v-if="mounted" to="#platform-sidenav">
        <SideNavigationTeamOptions>
            <template #nested-menu>
                <div class="ff-nested-title">Application</div>
                <router-link v-for="route in navigation" :key="route.label" :to="route.path">
                    <nav-item :icon="route.icon" :label="route.label" :data-nav="route.tag" />
                </router-link>
            </template>
        </SideNavigationTeamOptions>
    </Teleport>

    <ff-loading v-if="loading.deleting" message="Deleting Application..." />
    <ff-loading v-else-if="loading.suspend" message="Suspending Application..." />
    <main v-else-if="!application?.id">
        <ff-loading message="Loading Application..." />
    </main>
    <main v-else class="ff-with-status-header">
        <ConfirmApplicationDeleteDialog ref="confirmApplicationDeleteDialog" @confirm="deleteApplication" />
        <ConfirmInstanceDeleteDialog ref="confirmInstanceDeleteDialog" @confirm="deleteInstance" />
        <Teleport v-if="mounted" to="#platform-banner">
            <div v-if="isVisitingAdmin" class="ff-banner" data-el="banner-project-as-admin">
                You are viewing this application as an Administrator
            </div>
            <SubscriptionExpiredBanner :team="team" />
            <TeamTrialBanner v-if="team.billing?.trial" :team="team" />
        </Teleport>
        <div class="ff-instance-header">
            <InstanceStatusHeader>
                <template #hero>
                    <div class="flex-grow space-x-6 items-center inline-flex" data-el="application-name">
                        <div class="text-gray-800 text-xl font-bold">
                            <div class="text-sm font-medium text-gray-500">Application:</div>
                            {{ application.name }}
                        </div>
                    </div>
                </template>
            </InstanceStatusHeader>
        </div>
        <div class="px-3 py-3 md:px-6 md:py-6">
            <router-view
                :application="application"
                :instances="instancesArray"
                :is-visiting-admin="isVisitingAdmin"
                @application-updated="updateApplication"
                @application-delete="showConfirmDeleteApplicationDialog"
                @instance-start="instanceStart"
                @instance-restart="instanceRestart"
                @instance-suspend="instanceShowConfirmSuspend"
                @instance-delete="instanceShowConfirmDelete"
            />

            <InstanceStatusPolling v-for="instance in instancesArray" :key="instance.id" :instance="instance" @instance-updated="instanceUpdated" />
        </div>
    </main>
</template>

<script>
import { CogIcon, TerminalIcon, ViewListIcon } from '@heroicons/vue/solid'

import { mapState } from 'vuex'

import { Roles } from '../../../../forge/lib/roles.js'

import ApplicationApi from '../../api/application.js'
import InstanceApi from '../../api/instances.js'

import InstanceStatusHeader from '../../components/InstanceStatusHeader.vue'
import InstanceStatusPolling from '../../components/InstanceStatusPolling.vue'
import NavItem from '../../components/NavItem.vue'
import SideNavigationTeamOptions from '../../components/SideNavigationTeamOptions.vue'
import SubscriptionExpiredBanner from '../../components/banners/SubscriptionExpired.vue'
import TeamTrialBanner from '../../components/banners/TeamTrial.vue'
import PipelinesIcon from '../../components/icons/Pipelines.js'
import ProjectsIcon from '../../components/icons/Projects.js'

import permissionsMixin from '../../mixins/Permissions.js'

import alerts from '../../services/alerts.js'
import Dialog from '../../services/dialog.js'

import { InstanceStateMutator } from '../../utils/InstanceStateMutator.js'

import ConfirmInstanceDeleteDialog from '../instance/Settings/dialogs/ConfirmInstanceDeleteDialog.vue'

import ConfirmApplicationDeleteDialog from './Settings/dialogs/ConfirmApplicationDeleteDialog.vue'

export default {
    name: 'ProjectPage',
    components: {
        ConfirmApplicationDeleteDialog,
        ConfirmInstanceDeleteDialog,
        InstanceStatusHeader,
        InstanceStatusPolling,
        NavItem,
        SideNavigationTeamOptions,
        SubscriptionExpiredBanner,
        TeamTrialBanner
    },
    mixins: [permissionsMixin],
    data: function () {
        return {
            mounted: false,
            application: {},
            applicationInstances: new Map(),
            loading: {
                deleting: false,
                suspend: false
            }
        }
    },
    computed: {
        ...mapState('account', ['teamMembership', 'team', 'features']),
        isVisitingAdmin () {
            return this.teamMembership.role === Roles.Admin
        },
        isLoading () {
            return this.loading.deleting || this.loading.suspend
        },
        navigation () {
            const routes = [
                { label: 'Node-RED Instances', path: `/application/${this.application.id}/instances`, tag: 'application-overview', icon: ProjectsIcon },
                { label: 'Node-RED Logs', path: `/application/${this.application.id}/logs`, tag: 'application-logs', icon: TerminalIcon },
                { label: 'Audit Log', path: `/application/${this.application.id}/activity`, tag: 'application-activity', icon: ViewListIcon },
                { label: 'Settings', path: `/application/${this.application.id}/settings`, tag: 'application-settings', icon: CogIcon }
            ]
            if (this.features && this.features['devops-pipelines']) {
                routes.splice(1, 0, {
                    label: 'DevOps Pipelines',
                    path: `/application/${this.application.id}/pipelines`,
                    tag: 'application-pipelines',
                    icon: PipelinesIcon
                })
            }
            return routes
        },
        instancesArray () {
            return Array.from(this.applicationInstances.values())
        }
    },
    async created () {
        await this.updateApplication()

        this.$watch(
            () => this.$route.params.id,
            async () => {
                await this.updateApplication()
            }
        )
    },
    mounted () {
        this.mounted = true
    },
    methods: {
        async updateApplication () {
            const applicationId = this.$route.params.id
            try {
                this.applicationInstances = []
                const applicationPromise = ApplicationApi.getApplication(applicationId)
                const instancesPromise = ApplicationApi.getApplicationInstances(applicationId) // To-do needs to be enriched with instance state

                this.application = await applicationPromise
                const applicationInstances = await instancesPromise

                this.applicationInstances = new Map()
                applicationInstances.forEach(instance => {
                    this.applicationInstances.set(instance.id, instance)
                })

                // Not waited for, as loading status is slightly slower
                ApplicationApi
                    .getApplicationInstancesStatuses(applicationId)
                    .then((instanceStatuses) => {
                        instanceStatuses.forEach((instanceStatus) => {
                            this.applicationInstances.set(instanceStatus.id, {
                                ...this.applicationInstances.get(instanceStatus.id),
                                ...instanceStatus
                            })
                        })
                    })
                    .catch((err) => {
                        console.error(err)
                    })

                this.$store.dispatch('account/setTeam', this.application.team.slug)
            } catch (err) {
                this.$router.push({
                    name: 'PageNotFound',
                    params: { pathMatch: this.$router.currentRoute.value.path.substring(1).split('/') },
                    // preserve existing query and hash if any
                    query: this.$router.currentRoute.value.query,
                    hash: this.$router.currentRoute.value.hash
                })
            }
        },

        instanceUpdated: function (newData) {
            const mutator = new InstanceStateMutator(newData)
            mutator.clearState()

            this.applicationInstances.set(newData.id, {
                ...this.applicationInstances.get(newData.id),
                ...newData
            })
        },

        showConfirmDeleteApplicationDialog () {
            this.$refs.confirmApplicationDeleteDialog.show(this.application)
        },

        async deleteApplication () {
            this.loading.deleting = true

            try {
                await ApplicationApi.deleteApplication(this.application.id, this.team.id)
                await this.$store.dispatch('account/refreshTeam')
                this.$router.push({ name: 'Home' })
                alerts.emit('Application successfully deleted.', 'confirmation')
            } catch (err) {
                if (err.response.data.error) {
                    alerts.emit(`Application failed to delete: ${err.response.data.error}`, 'warning', 10000)
                } else {
                    alerts.emit('Application failed to delete', 'warning')
                }
            }

            this.loading.deleting = false
        },

        async instanceStart (instance) {
            const mutator = new InstanceStateMutator(instance)
            mutator.setStateOptimistically('starting')

            const err = await InstanceApi.startInstance(instance)
            if (err) {
                console.warn('Instance start failed.', err)
                alerts.emit('Instance start failed.', 'warning')

                mutator.restoreState()
            } else {
                mutator.setStateAsPendingFromServer()
            }
        },

        async instanceRestart (instance) {
            const mutator = new InstanceStateMutator(instance)
            mutator.setStateOptimistically('restarting')

            const err = await InstanceApi.restartInstance(instance)
            if (err) {
                console.warn('Instance restart failed.', err)
                alerts.emit('Instance restart failed.', 'warning')

                mutator.restoreState()
            } else {
                mutator.setStateAsPendingFromServer()
            }
        },

        instanceShowConfirmSuspend (instance) {
            Dialog.show({
                header: 'Suspend Instance',
                text: `Are you sure you want to suspend ${instance.name}`,
                confirmLabel: 'Suspend',
                kind: 'danger'
            }, () => {
                const mutator = new InstanceStateMutator(instance)
                mutator.setStateOptimistically('suspending')

                InstanceApi.suspendInstance(instance).then(() => {
                    mutator.setStateAsPendingFromServer()

                    alerts.emit('Instance suspend request succeeded.', 'confirmation')
                }).catch(err => {
                    console.warn(err)
                    alerts.emit('Instance failed to suspend.', 'warning')

                    mutator.restoreState()
                })
            })
        },

        instanceShowConfirmDelete (instance) {
            this.$refs.confirmInstanceDeleteDialog.show(instance)
        },

        deleteInstance (instance) {
            this.loading.deleting = true
            InstanceApi.deleteInstance(instance).then(async () => {
                alerts.emit('Instance successfully deleted.', 'confirmation')
                this.updateApplication()
            }).catch(err => {
                console.warn(err)
                alerts.emit('Instance failed to delete.', 'warning')
            }).finally(() => {
                this.loading.deleting = false
            })
        }
    }
}
</script>
