/**
 * An Audit log entry
 * @namespace forge.db.models.AuditLog
 */

const { DataTypes, Op } = require('sequelize')

const { buildPaginationSearchClause } = require('../utils')

module.exports = {
    name: 'AuditLog',
    schema: {
        event: { type: DataTypes.STRING },
        body: { type: DataTypes.TEXT },
        entityId: { type: DataTypes.STRING },
        entityType: { type: DataTypes.STRING }
    },
    options: {
        updatedAt: false
    },
    associations: function (M) {
        this.belongsTo(M.User)
        this.belongsTo(M.Project)//, { foreignKey: 'ownerId', constraints: false });
        this.belongsTo(M.Team, { foreignKey: 'ownerId', constraints: false })
    },
    finders: function (M) {
        return {
            static: {
                forPlatform: async (pagination = {}) => {
                    const where = {
                        [Op.or]: [{ entityType: 'platform' }, { entityType: 'user' }]
                    }
                    return M.AuditLog.forEntity(where, pagination)
                },
                forProject: async (projectId, pagination = {}) => {
                    const where = {
                        entityId: projectId.toString(),
                        entityType: 'project'
                    }
                    return M.AuditLog.forEntity(where, pagination)
                },
                forTeam: async (teamId, pagination = {}) => {
                    const where = {
                        entityId: teamId.toString(),
                        entityType: 'team'
                    }
                    return M.AuditLog.forEntity(where, pagination)
                },
                forEntity: async (where = {}, pagination = {}) => {
                    const limit = parseInt(pagination.limit) || 1000
                    if (pagination.cursor) {
                        where.id = { [Op.lt]: M.AuditLog.decodeHashid(pagination.cursor) }
                    }

                    const { count, rows } = await this.findAndCountAll({
                        where: buildPaginationSearchClause(pagination, where, ['AuditLog.event']),
                        order: [['createdAt', 'DESC']],
                        include: {
                            model: M.User,
                            attributes: ['id', 'hashid', 'username']
                        },
                        limit
                    })

                    return {
                        meta: {
                            next_cursor: rows.length === limit ? rows[rows.length - 1].hashid : undefined
                        },
                        count,
                        log: rows
                    }
                }
            }
        }
    },
    meta: {
        slug: false,
        links: false
    }
}
