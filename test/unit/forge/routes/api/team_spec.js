const should = require('should') // eslint-disable-line

const { KEY_SETTINGS } = require('../../../../../forge/db/models/ProjectSettings')
const setup = require('../setup')

const FF_UTIL = require('flowforge-test-utils')
const { Roles } = FF_UTIL.require('forge/lib/roles')

describe('Team API', function () {
    let app
    const TestObjects = {}
    beforeEach(async function () {
        const opts = {}
        if (this.currentTest.license) {
            opts.license = this.currentTest.license
        }
        app = await setup(opts)

        // Alice create in setup()
        TestObjects.alice = await app.db.models.User.byUsername('alice')
        TestObjects.bob = await app.db.models.User.create({ username: 'bob', name: 'Bob Solo', email: 'bob@example.com', email_verified: true, password: 'bbPassword' })
        TestObjects.chris = await app.db.models.User.create({ username: 'chris', name: 'Chris Kenobi', email: 'chris@example.com', email_verified: true, password: 'ccPassword' })

        TestObjects.ATeam = await app.db.models.Team.byName('ATeam')
        TestObjects.BTeam = await app.db.models.Team.create({ name: 'BTeam', TeamTypeId: app.defaultTeamType.id })
        TestObjects.CTeam = await app.db.models.Team.create({ name: 'CTeam abc', TeamTypeId: app.defaultTeamType.id })
        TestObjects.DTeam = await app.db.models.Team.create({ name: 'DTeAbCam', TeamTypeId: app.defaultTeamType.id })

        await TestObjects.ATeam.addUser(TestObjects.bob, { through: { role: Roles.Member } })
        await TestObjects.BTeam.addUser(TestObjects.bob, { through: { role: Roles.Owner } })

        TestObjects.tokens = {}
        await login('alice', 'aaPassword')
        await login('bob', 'bbPassword')
        await login('chris', 'ccPassword')
    })

    async function login (username, password) {
        const response = await app.inject({
            method: 'POST',
            url: '/account/login',
            payload: { username, password, remember: false }
        })
        response.cookies.should.have.length(1)
        response.cookies[0].should.have.property('name', 'sid')
        TestObjects.tokens[username] = response.cookies[0].value
    }

    afterEach(async function () {
        if (app) {
            await app.close()
            app = null
        }
    })

    describe('Team API', function async () {
        describe('Get team details', async function () {
            // GET /api/v1/teams/:teamId
            // - Must be admin or team owner/member
        })

        describe('Get team details by slug', async function () {
            // GET /api/v1/teams/:teamId?slug=<teamSlug>
            // - Must be admin or team owner/member
        })

        describe('Get list of teams', async function () {
            // GET /api/v1/teams/:teamId

            const getTeams = async (limit, cursor, search) => {
                const query = {}
                // app.inject will inject undefined values as the string 'undefined' rather
                // than ignore them. So need to build-up the query object the long way
                if (limit !== undefined) {
                    query.limit = limit
                }
                if (cursor !== undefined) {
                    query.cursor = cursor
                }
                if (search !== undefined) {
                    query.query = search
                }
                const response = await app.inject({
                    method: 'GET',
                    url: '/api/v1/teams',
                    query,
                    cookies: { sid: TestObjects.tokens.alice }
                })
                return response.json()
            }

            it('returns a list of all teams', async function () {
                const result = await getTeams()
                result.teams.should.have.length(4)
            })

            it('can page through list', async function () {
                const firstPage = await getTeams(2)
                firstPage.should.have.property('meta')
                firstPage.meta.should.have.property('next_cursor', TestObjects.BTeam.hashid)
                firstPage.teams.should.have.length(2)
                firstPage.teams[0].should.have.property('name', 'ATeam')
                firstPage.teams[1].should.have.property('name', 'BTeam')

                const secondPage = await getTeams(2, firstPage.meta.next_cursor)
                secondPage.meta.should.have.property('next_cursor', TestObjects.DTeam.hashid)
                secondPage.teams.should.have.length(2)
                secondPage.teams[0].should.have.property('name', 'CTeam abc')
                secondPage.teams[1].should.have.property('name', 'DTeAbCam')

                const thirdPage = await getTeams(2, secondPage.meta.next_cursor)
                thirdPage.meta.should.not.have.property('next_cursor')
                thirdPage.teams.should.have.length(0)
            })
            it('can search for teams - name', async function () {
                const firstPage = await getTeams(undefined, undefined, 'aBC')
                firstPage.meta.should.not.have.property('next_cursor')
                firstPage.teams.should.have.length(2)
                firstPage.teams[0].should.have.property('name', 'CTeam abc')
                firstPage.teams[1].should.have.property('name', 'DTeAbCam')
            })
        })

        describe('Get list of a teams applications and their instances', async function () {
            beforeEach(async function () {
                TestObjects.TeamAApp = await app.db.models.Application.create({ name: 'team-a-application', TeamId: TestObjects.ATeam.id })
                TestObjects.TeamAApp2 = await app.db.models.Application.create({ name: 'team-a-application-2', TeamId: TestObjects.ATeam.id })
                TestObjects.TeamBApp = await app.db.models.Application.create({ name: 'team-b-application', TeamId: TestObjects.BTeam.id })
            })

            it('for an admin lists all the applications in a team', async function () {
                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.BTeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.alice }
                })

                response.statusCode.should.equal(200)

                // TODO Enhance test
                const result = response.json()
                result.should.have.property('count', 1)
                result.should.have.property('applications').and.have.a.lengthOf(1)
                result.applications[0].should.have.property('id', TestObjects.TeamBApp.hashid)
                result.applications[0].should.have.property('name', 'team-b-application')
            })

            it('for an owner lists all the applications in a team', async function () {
                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.BTeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.bob }
                })

                response.statusCode.should.equal(200)

                const result = response.json()
                result.should.have.property('count', 1)
                result.should.have.property('applications').and.have.a.lengthOf(1)
                should(result.applications.some((application) => application.name === 'team-b-application')).equal(true)
            })

            it('for an member lists all the applications in a team', async function () {
                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.ATeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.bob }
                })

                response.statusCode.should.equal(200)

                const result = response.json()
                result.should.have.property('count', 3)
                result.should.have.property('applications').and.have.a.lengthOf(3)
                should(result.applications.some((application) => application.name === 'team-a-application')).equal(true)
                should(result.applications.some((application) => application.name === 'team-a-application-2')).equal(true)
            })

            it('lists all instances within each application', async function () {
                const secondInstance = await app.factory.createInstance({ name: 'second-instance' }, app.application, app.stack, app.template, app.projectType)

                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.ATeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.bob }
                })

                response.statusCode.should.equal(200)

                const result = response.json()
                const application = result.applications.find((application) => application.name === app.application.name)

                application.should.have.property('instances').and.have.a.lengthOf(2)

                should(application.instances.some((instance) => instance.name === app.project.name)).equal(true)
                should(application.instances.some((instance) => instance.name === secondInstance.name)).equal(true)
            })

            it('includes the instance URL for each accounting for httpAdminRoot', async function () {
                const instance = await app.factory.createInstance({ name: 'another-instance' }, app.application, app.stack, app.template, app.projectType, { start: true })
                await instance.updateSetting(KEY_SETTINGS, { httpAdminRoot: '/editor' })

                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.ATeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.bob }
                })

                response.statusCode.should.equal(200)

                const result = response.json()
                const application = result.applications.find((application) => application.name === app.application.name)

                application.should.have.property('instances').and.have.a.lengthOf(2)

                const instanceDetails = application.instances.find((instance) => instance.name === 'another-instance')

                instanceDetails.should.have.property('id', instance.id)
                instanceDetails.should.have.property('url', 'http://another-instance.example.com/editor') // from stub driver
            })

            it('fails if a user is not member of the team', async function () {
                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.ATeam.hashid}/applications`,
                    cookies: { sid: TestObjects.tokens.chris }
                })

                response.statusCode.should.equal(404)

                const result = response.json()
                result.should.have.property('code', 'not_found')
                result.should.have.property('error')
            })
        })

        describe('Get list of a teams applications, their instances and their statuses', async function () {
            it('lists all instances within each application', async function () {
                const secondInstance = await app.factory.createInstance({ name: 'second-instance' }, app.application, app.stack, app.template, app.projectType, { start: false })
                const thirdInstance = await app.factory.createInstance({ name: 'third-instance' }, app.application, app.stack, app.template, app.projectType, { start: false })

                // Running
                const startResult = await app.containers.start(secondInstance)
                await startResult.started

                // Starting
                await app.containers.start(thirdInstance)

                const response = await app.inject({
                    method: 'GET',
                    url: `/api/v1/teams/${TestObjects.ATeam.hashid}/applications/status`,
                    cookies: { sid: TestObjects.tokens.bob }
                })

                response.statusCode.should.equal(200)

                const result = response.json()
                const application = result.applications.find((application) => application.id === app.application.hashid)

                application.should.have.property('instances').and.have.a.lengthOf(3)

                const firstInstanceStatus = application.instances.find((instance) => instance.id === app.project.id)
                firstInstanceStatus.meta.should.have.property('state', 'unknown')

                const secondInstanceStatus = application.instances.find((instance) => instance.id === secondInstance.id)
                secondInstanceStatus.meta.should.have.property('state', 'running')

                const thirdInstanceStatus = application.instances.find((instance) => instance.id === thirdInstance.id)
                thirdInstanceStatus.meta.should.have.property('state', 'starting')
            })
        })

        describe('Get list of a teams projects', async function () {
            // GET /api/v1/teams/:teamId/projects
            // - Admin/Owner/Member
        })

        describe('Create team', async function () {
            // POST /api/v1/teams
            // - Admin/Owner/Member
        })

        describe('Delete team', async function () {
            // DELETE /api/v1/teams/:teamId
            // - Admin/Owner/Member
            // - should fail if team owns projects
        })

        describe('Edit team details', async function () {
            // PUT /api/v1/teams/:teamId
        })

        describe('Get current users membership', async function () {
            // GET /api/v1/teams/:teamId/user
        })

        describe('Get team audit-log', async function () {
            // GET /api/v1/teams/:teamId/audit-log
        })
    })
    describe('License limits', async function () {
        it('Permits overage when licensed', async function () {
            // This license has limit of 4 teams (2 created by default test setup)
            await app.license.apply('eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJGbG93Rm9yZ2UgSW5jLiIsInN1YiI6IkZsb3dGb3JnZSBJbmMuIERldmVsb3BtZW50IiwibmJmIjoxNjYyNTk1MjAwLCJleHAiOjc5ODcwNzUxOTksIm5vdGUiOiJEZXZlbG9wbWVudC1tb2RlIE9ubHkuIE5vdCBmb3IgcHJvZHVjdGlvbiIsInVzZXJzIjoxNTAsInRlYW1zIjo0LCJwcm9qZWN0cyI6NTAsImRldmljZXMiOjUwLCJkZXYiOnRydWUsImlhdCI6MTY2MjYzMTU4N30.J6ceWv3SdFC-J_dt05geeQZHosD1D102u54tVLeu_4EwRO5OYGiqMxFW3mx5pygod3xNT68e2Wq8A7wNVCt3Rg')
            // Alice create in setup()
            TestObjects.alice = await app.db.models.User.byUsername('alice')
            TestObjects.defaultTeamType = await app.db.models.TeamType.findOne()
            TestObjects.tokens = {}
            await login('alice', 'aaPassword')

            // Check we're at the starting point we expect - want 2 teams
            await TestObjects.CTeam.destroy()
            await TestObjects.DTeam.destroy()
            ;(await app.db.models.Team.count()).should.equal(2)

            for (let i = 0; i < 3; i++) {
                const response = await app.inject({
                    method: 'POST',
                    url: '/api/v1/teams',
                    cookies: { sid: TestObjects.tokens.alice },
                    payload: {
                        name: `t${i}`,
                        slug: `t${i}`,
                        type: TestObjects.defaultTeamType.hashid
                    }
                })
                response.statusCode.should.equal(200)
            }

            ;(await app.db.models.Team.count()).should.equal(5)
        })

        it('Does not permit overage when unlicensed', async function () {
            app.license.defaults.teams = 4 // override default
            // Alice created in setup()
            TestObjects.alice = await app.db.models.User.byUsername('alice')
            TestObjects.defaultTeamType = await app.db.models.TeamType.findOne()
            TestObjects.tokens = {}
            await login('alice', 'aaPassword')

            // Check we're at the starting point we expect - want 2 teams
            await TestObjects.CTeam.destroy()
            await TestObjects.DTeam.destroy()
            ;(await app.db.models.Team.count()).should.equal(2)

            for (let i = 0; i < 2; i++) {
                const response = await app.inject({
                    method: 'POST',
                    url: '/api/v1/teams',
                    cookies: { sid: TestObjects.tokens.alice },
                    payload: {
                        name: `t${i}`,
                        slug: `t${i}`,
                        type: TestObjects.defaultTeamType.hashid
                    }
                })
                response.statusCode.should.equal(200)
            }

            ;(await app.db.models.Team.count()).should.equal(4)

            const failResponse = await app.inject({
                method: 'POST',
                url: '/api/v1/teams',
                cookies: { sid: TestObjects.tokens.alice },
                payload: {
                    name: 't2',
                    slug: 't2',
                    type: TestObjects.defaultTeamType.hashid
                }
            })
            failResponse.statusCode.should.equal(400)
            failResponse.json().error.should.match(/license limit/)
        })
    })

    describe('Create team', async function () {
        // POST /api/v1/teams
        // - Admin/Owner/Member
    })

    describe('Delete team', async function () {
        // DELETE /api/v1/teams/:teamId
        // - Admin/Owner/Member
        // - should fail if team owns projects

        it('removes pending invitations', async function () {
            // Alice invites Chris to TeamA
            // Delete TeamB
            await app.inject({
                method: 'POST',
                url: `/api/v1/teams/${TestObjects.BTeam.hashid}/invitations`,
                cookies: { sid: TestObjects.tokens.alice },
                payload: {
                    user: 'chris'
                }
            })
            const inviteListA = (await app.inject({
                method: 'GET',
                url: `/api/v1/teams/${TestObjects.BTeam.hashid}/invitations`,
                cookies: { sid: TestObjects.tokens.alice }
            })).json()
            inviteListA.should.have.property('count', 1)
            const deleteResult = await app.inject({
                method: 'DELETE',
                url: `/api/v1/teams/${TestObjects.BTeam.hashid}`,
                cookies: { sid: TestObjects.tokens.alice }
            })
            deleteResult.statusCode.should.equal(200)
            const inviteListChris = (await app.inject({
                method: 'GET',
                url: '/api/v1/user/invitations',
                cookies: { sid: TestObjects.tokens.chris }
            })).json()
            inviteListChris.should.have.property('count', 0)
        })
    })

    describe('Edit team details', async function () {
        // PUT /api/v1/teams/:teamId
    })

    describe('Get current users membership', async function () {
        // GET /api/v1/teams/:teamId/user
    })

    describe('Get team audit-log', async function () {
        // GET /api/v1/teams/:teamId/audit-log
    })

    describe('Check slug availability', async function () {
        it('reports if slug is available', async function () {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/teams/check-slug',
                cookies: { sid: TestObjects.tokens.alice },
                payload: {
                    slug: 'new-slug'
                }
            })
            response.statusCode.should.equal(200)
        })
        it('reports if slug is unavailable', async function () {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/teams/check-slug',
                cookies: { sid: TestObjects.tokens.alice },
                payload: {
                    slug: 'ateam'
                }
            })
            response.statusCode.should.equal(409)
        })
        it('reports if slug is reserved', async function () {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/teams/check-slug',
                cookies: { sid: TestObjects.tokens.alice },
                payload: {
                    slug: 'create'
                }
            })
            response.statusCode.should.equal(409)
        })
    })
})
