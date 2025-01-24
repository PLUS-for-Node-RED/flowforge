<template>
    <SectionTopMenu
        hero="DevOps Pipelines"
        help-header="FlowForge - DevOps Pipelines"
        info="Configure automated deployments between your Instances"
    >
        <template #helptext>
            <p>
                DevOps Pipelines are used to link multiple Node-RED instances together
                in a deployment pipeline.
            </p>
            <p>
                This is normally used to define "Development" instances, where you can
                test your new flows without fear or breaking "Production" environments.
            </p>
            <p>
                Then, when you're ready, you could run a given stage of the pipeline to
                promote your instance to "Staging" or "Production".
            </p>
        </template>
        <template #tools>
            <ff-button
                data-action="pipeline-add"
                :to="{
                    name: 'CreatePipeline',
                    params: { applicationId: application.id },
                }"
            >
                <template #icon-left>
                    <PlusSmIcon />
                </template>
                Add Pipeline
            </ff-button>
        </template>
    </SectionTopMenu>

    <div v-if="pipelines?.length > 0" class="pt-4 space-y-6">
        <PipelineRow
            v-for="pipeline in pipelines"
            :key="pipeline.id"
            :application="application"
            :pipeline="pipeline"
            :status-map="instanceStatusMap"
            @deploy-started="beginPolling"
            @deploy-complete="loadPipelines"
            @pipeline-deleted="loadPipelines"
            @stage-deleted="(stageIndex) => stageDeleted(pipeline, stageIndex)"
        />
    </div>
    <EmptyState v-else>
        <template #header>Add your Application's First DevOps Pipeline</template>
        <template #img>
            <img src="../../images/empty-states/application-pipelines.png">
        </template>
        <template #message>
            <p>
                DevOps Pipelines are used to link multiple Node-RED instances together
                in a deployment pipeline.
            </p>
            <p>
                This is normally used to define "Development" instances, where you can
                test your new flows without fear or breaking "Production" environments.
            </p>
            <p>
                Then, when you're ready, you could run a given stage of the pipeline to
                promote your instance to "Staging" or "Production".
            </p>
        </template>
        <template #actions>
            <ff-button
                :to="{
                    name: 'CreatePipeline',
                    params: { applicationId: application.id },
                }"
            >
                <template #icon-left><PlusSmIcon /></template>
                Add Pipeline
            </ff-button>
        </template>
    </EmptyState>
</template>

<script>
import { PlusSmIcon } from '@heroicons/vue/outline'
import { mapState } from 'vuex'

import ApplicationAPI from '../../api/application.js'
import PipelineAPI from '../../api/pipeline.js'

import EmptyState from '../../components/EmptyState.vue'
import SectionTopMenu from '../../components/SectionTopMenu.vue'
import PipelineRow from '../../components/pipelines/PipelineRow.vue'

import Alerts from '../../services/alerts.js'

export default {
    name: 'ApplicationPipelines',
    components: {
        SectionTopMenu,
        PlusSmIcon,
        PipelineRow,
        EmptyState
    },
    beforeRouteLeave () {
        clearInterval(this.polling)
    },
    inheritAttrs: false,
    props: {
        instances: {
            type: Array,
            required: true
        },
        application: {
            type: Object,
            required: true
        }
    },
    data () {
        return {
            pipelines: [],
            instanceStatusMap: new Map(),
            polling: null
        }
    },
    computed: {
        ...mapState('account', ['features'])
    },
    mounted () {
        if (this.features['devops-pipelines']) {
            this.loadPipelines()
        } else {
            this.$router.push({
                name: 'Application',
                params: {
                    id: this.application.id
                }
            })
        }
    },
    methods: {
        beginPolling () {
            this.polling = setInterval(this.loadInstanceStatus, 5000)
        },
        async stageDeleted (pipeline, stageIndex) {
            pipeline.stages.splice(stageIndex, 1)

            if (pipeline.stages[stageIndex - 1]) {
                const stage = pipeline.stages[stageIndex - 1]

                const reloadedStage = await PipelineAPI.getPipelineStage(pipeline.id, stage.id)

                Object.assign(stage, reloadedStage)
            }
        },
        async loadPipelines () {
            this.loadInstanceStatus()
            ApplicationAPI.getPipelines(this.application.id)
                .then((pipelines) => {
                    this.pipelines = pipelines
                })
                .catch((err) => {
                    console.error(err)
                })
        },
        async loadInstanceStatus () {
            ApplicationAPI.getApplicationInstancesStatuses(this.application.id)
                .then((instances) => {
                    if (this.polling) {
                        let allRunning = true
                        for (const instance of instances) {
                            if (instance.meta.state !== 'running') {
                                allRunning = false
                            }
                        }
                        // we were polling for status (triggered by deploy) but now everything is "running"
                        if (this.polling && allRunning) {
                            clearInterval(this.polling)
                            Alerts.emit('Deployment of stage successful.', 'confirmation')
                        }
                    }
                    this.instanceStatusMap = new Map(
                        instances.map((obj) => [obj.id, obj.meta])
                    )
                })
                .catch((err) => {
                    console.error(err)
                })
        }
    }
}
</script>

<style lang="scss">
@import "../../stylesheets/components/pipelines.scss";
</style>
