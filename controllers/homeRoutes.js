const router = require('express').Router()
const { Reward } = require('../models')

router.get('/', async(req, res) => {
    try {
        let stringList = req.session.rewardsList
        let parsedRewards = []
        if(stringList) {
            parsedRewards = JSON.parse(stringList)
            parsedRewards.sort(function(a, b) {
                let keyA = parseInt(a.index)
                let keyB = parseInt(b.index)
                if(keyA < keyB) return -1;
                if(keyA > keyB) return 1;
                return 0;
            })
        }
        else {
            const rewardsList = []
            stringList = ""
        }
        let trackDefinitions = []
        if (req.session.trackDefinitions && req.session.trackDefinitions !== "") {
            try {
                const parsedDefinitions = JSON.parse(req.session.trackDefinitions)
                if (Array.isArray(parsedDefinitions)) {
                    trackDefinitions = parsedDefinitions
                }
            }
            catch (err) {
                trackDefinitions = []
            }
        }

        const normalizer = new Reward
        const baseTrackIds = { free: true, premium: true }
        const normalizeDefinitionInput = (definition, fallback) => {
            const fallbackDefinition = fallback || {}
            const normalized = normalizer.normalizeTrack(definition || {})
            const id = normalized.id
            if (!id) {
                return null
            }
            const fallbackLabel = fallbackDefinition.label || ""
            const fallbackPermission = typeof fallbackDefinition.permission === "string" ? fallbackDefinition.permission : ""
            const fallbackRemovable = typeof fallbackDefinition.removable === "boolean" ? fallbackDefinition.removable : !baseTrackIds[id]
            const label = normalized.label || fallbackLabel || normalizer.formatLabel(id)
            const permission = normalized._permissionDefined ? normalized.permission : fallbackPermission
            let removable = fallbackRemovable
            if (definition && typeof definition.removable === "boolean") {
                removable = definition.removable
            }
            if (typeof removable !== "boolean") {
                removable = !baseTrackIds[id]
            }
            return { id, label, permission, removable }
        }

        const sanitizedDefinitions = []
        const definitionIndexById = new Map()
        if (Array.isArray(trackDefinitions)) {
            trackDefinitions.forEach((definition) => {
                if (!definition) {
                    return
                }
                const normalized = normalizeDefinitionInput(definition, {})
                if (!normalized) {
                    return
                }
                sanitizedDefinitions.push(normalized)
                definitionIndexById.set(normalized.id, sanitizedDefinitions.length - 1)
            })
        }
        trackDefinitions = sanitizedDefinitions

        const upsertDefinition = (definition, fallback) => {
            const normalized = normalizeDefinitionInput(definition, fallback)
            if (!normalized) {
                return null
            }
            if (definitionIndexById.has(normalized.id)) {
                const existingIndex = definitionIndexById.get(normalized.id)
                const existing = trackDefinitions[existingIndex]
                const merged = {
                    id: normalized.id,
                    label: normalized.label || existing.label,
                    permission: normalized.permission,
                    removable: typeof existing.removable === "boolean" ? existing.removable : normalized.removable
                }
                trackDefinitions[existingIndex] = merged
                return merged
            }
            const entry = {
                id: normalized.id,
                label: normalized.label,
                permission: normalized.permission,
                removable: normalized.removable
            }
            definitionIndexById.set(entry.id, trackDefinitions.length)
            trackDefinitions.push(entry)
            return entry
        }

        upsertDefinition({ id: "free", label: "Free", removable: false }, definitionIndexById.has("free") ? trackDefinitions[definitionIndexById.get("free")] : {})
        upsertDefinition({ id: "premium", label: "Premium", removable: false }, definitionIndexById.has("premium") ? trackDefinitions[definitionIndexById.get("premium")] : {})

        const trackDefinitionsString = JSON.stringify(trackDefinitions)
        const trackDefinitionsJson = trackDefinitionsString.replace(/<\/(script)/gi, '<\\/$1')

        req.session.save(() => {
            req.session.rewardsList = stringList
            req.session.trackDefinitions = trackDefinitionsString
            res.render('homepage', {
                rewardsList: parsedRewards,
                stringified: JSON.stringify(parsedRewards, null, 4),
                trackDefinitionsJson
            });
          })

    }
    catch (err) {
        console.log(err)
        res.status(500).json(err)
    }
})

router.put('/', async(req, res) => {
    const rewardsList = req.body
    res.render('homepage', {rewardsList: rewardsList, stringified: req.body})
})

module.exports = router;