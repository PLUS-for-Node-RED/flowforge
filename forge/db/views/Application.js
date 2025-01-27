module.exports = {
    application: function (app, application) {
        if (application) {
            const raw = application.toJSON()
            const filtered = {
                id: raw.hashid,
                name: raw.name,
                createdAt: raw.createdAt,
                updatedAt: raw.updatedAt,
                links: raw.links
            }

            if (application.Team) {
                filtered.team = app.db.views.Team.teamSummary(application.Team)
            }

            return filtered
        } else {
            return null
        }
    },
    applicationSummary: function (app, application) {
        // application could already be a vanilla object,
        // or a database model object.
        if (Object.hasOwn(application, 'get')) {
            application = application.get({ plain: true })
        }

        return {
            id: application.hashid,
            name: application.name,
            links: application.links
        }
    },
    async teamApplicationList (app, applications, { includeInstances = false } = {}) {
        return await Promise.all(applications.map(async (application) => {
            const summary = app.db.views.Application.applicationSummary(application)
            if (includeInstances) {
                summary.instances = await app.db.views.Project.instancesList(application.Instances)
            }

            return summary
        }))
    },
    async instanceStatuses (app, instancesArray) {
        return await Promise.all(instancesArray.map(async (instance) => {
            const state = await instance.liveState()
            return { id: instance.id, ...state }
        }))
    }
}
