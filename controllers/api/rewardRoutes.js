const { Reward } = require('../../models')
const {compareKeys} = require('../../utils/formatters')
const router = require('express').Router()

router.post("/", (req, res) => {
    try {
        const postBody = req.body
        let rewardsList = []
        if (req.session.rewardsList && req.session.rewardsList != []) {
            rewardsList = JSON.parse(req.session.rewardsList)
        }
        const newReward = new Reward

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

        const baseTrackIds = { free: true, premium: true }

        const normalizeDefinitionInput = (definition, fallback) => {
            const fallbackDefinition = fallback || {}
            const normalized = newReward.normalizeTrack(definition || {})
            const id = normalized.id
            const fallbackLabel = fallbackDefinition.label || ""
            const fallbackPermission = typeof fallbackDefinition.permission === "string" ? fallbackDefinition.permission : ""
            const fallbackRemovable = typeof fallbackDefinition.removable === "boolean" ? fallbackDefinition.removable : !baseTrackIds[id]
            const label = normalized.label || fallbackLabel || newReward.formatLabel(id)
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
                if (!normalized.id) {
                    return
                }
                sanitizedDefinitions.push(normalized)
                definitionIndexById.set(normalized.id, sanitizedDefinitions.length - 1)
            })
        }
        trackDefinitions = sanitizedDefinitions

        const upsertDefinition = (definition, fallback) => {
            const normalized = normalizeDefinitionInput(definition, fallback)
            if (!normalized.id) {
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

        const trackPayload = Array.isArray(postBody.tracks) ? postBody.tracks : []

        if(trackPayload.length === 0) {
            const freeDefinition = definitionIndexById.has("free") ? trackDefinitions[definitionIndexById.get("free")] : { id: "free", label: "Free", permission: "" }
            const premiumDefinition = definitionIndexById.has("premium") ? trackDefinitions[definitionIndexById.get("premium")] : { id: "premium", label: "Premium", permission: "" }
            trackPayload.push({
                id: freeDefinition.id,
                label: freeDefinition.label,
                permission: freeDefinition.permission,
                itemName: postBody.freeItemName,
                itemCount: postBody.freeItemCount,
                itemType: postBody.freeItemType,
                commandText: postBody.freeCommandText,
                commandItem: postBody.freeCommandItem,
                commandItemType: postBody.freeCommandItemType,
                commandLore: postBody.freeCommandLore,
                pokemon: postBody.freePokemon,
                texture: postBody.freeTexture,
                level: postBody.freeLevel,
                miniv: postBody.freeMiniv,
                nature: postBody.freeNature
            })
            trackPayload.push({
                id: premiumDefinition.id,
                label: premiumDefinition.label,
                permission: premiumDefinition.permission,
                itemName: postBody.premiumItemName,
                itemCount: postBody.premiumItemCount,
                itemType: postBody.premiumItemType,
                commandText: postBody.premiumCommandText,
                commandItem: postBody.premiumCommandItem,
                commandItemType: postBody.premiumCommandItemType,
                commandLore: postBody.premiumCommandLore,
                pokemon: postBody.premiumPokemon,
                texture: postBody.premiumTexture,
                level: postBody.premiumLevel,
                miniv: postBody.premiumMiniv,
                nature: postBody.premiumNature
            })
        }

        const initTracks = trackPayload.map((track) => {
            const existing = track && track.id && definitionIndexById.has(track.id) ? trackDefinitions[definitionIndexById.get(track.id)] : {}
            const updated = upsertDefinition(track, existing || {})
            return updated ? { id: updated.id, label: updated.label, permission: updated.permission } : null
        }).filter(Boolean)

        if(postBody.index) {
            newReward.initReward(postBody.index, initTracks)
        }
        else if(rewardsList.length > 0) {
            newReward.initReward(parseInt(rewardsList[rewardsList.length - 1].index) + 1, initTracks)
        }
        else {
            newReward.initReward(1, initTracks)
        }

        const trackDefinitionMap = new Map()
        initTracks.forEach((track) => {
            trackDefinitionMap.set(track.id, track)
        })

        trackPayload.forEach((track) => {
            const normalized = newReward.normalizeTrack(track)
            const baseDefinition = trackDefinitionMap.get(normalized.id) || upsertDefinition(track, {}) || { id: normalized.id, label: normalized.label, permission: normalized.permission }
            const trackIdentifier = {
                id: baseDefinition.id,
                label: baseDefinition.label,
                permission: typeof baseDefinition.permission === "string" ? baseDefinition.permission : ""
            }
            newReward.ensureTrack(trackIdentifier)

            const itemName = track.itemName ? track.itemName.toString().trim() : ""
            if(itemName) {
                let count = 1
                if(track.itemCount) {
                    count = parseInt(track.itemCount, 10)
                }
                const source = track.itemType && track.itemType !== "" ? track.itemType : "minecraft"
                newReward.addItem(trackIdentifier, source, itemName, count)
            }

            const commandText = track.commandText ? track.commandText.toString().trim() : ""
            if(commandText) {
                let source = "minecraft"
                let item = "diamond"
                let lore = "A command reward!"
                if(track.commandItemType && track.commandItemType !== "") {
                    source = track.commandItemType
                }
                if(track.commandItem && track.commandItem !== "") {
                    item = track.commandItem
                }
                if(track.commandLore && track.commandLore !== "") {
                    lore = track.commandLore
                }
                newReward.addCommand(trackIdentifier, commandText, source, item, lore)
            }

            if(track.pokemon) {
                let specs = {}
                if(track.level) {
                    specs.level = track.level
                }
                if(track.texture) {
                    specs.customTexture = track.texture
                }
                if(track.miniv) {
                    specs.miniv = track.miniv
                }
                if(track.nature) {
                    specs.nature = track.nature
                }
                newReward.addPokemon(trackIdentifier, track.pokemon, specs)
            }
        })

        rewardsList = rewardsList.filter(reward => {
            return reward.index != postBody.index
        })
        rewardsList.push(newReward)
        rewardsList.sort(function(a, b) {
            let keyA = parseInt(a.index)
            let keyB = parseInt(b.index)
            if(keyA < keyB) return -1;
            if(keyA > keyB) return 1;
            return 0;
        })
        const stringified = JSON.stringify(rewardsList)
        req.session.save(() => {
            req.session.rewardsList = stringified
            req.session.trackDefinitions = JSON.stringify(trackDefinitions)
            res.status(200).json(req.session.rewardsList);
        })
    }
    catch (err) {
        console.log(err)
        res.status(500).json(err)
    }

})

router.post("/import", (req, res) => {
    try {
        const rewardsList = req.body
        const testReward = new Reward;
        let brokenJson = false;
        rewardsList.forEach((reward, index) => {
            if(!compareKeys(testReward, rewardsList[index])) {
                brokenJson = true;
            }
        })
        if(!brokenJson) {
            const normalizer = new Reward
            const baseTrackIds = { free: true, premium: true }
            const definitionMap = new Map()

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

            const upsertDefinition = (definition) => {
                const preliminary = normalizer.normalizeTrack(definition || {})
                const existing = preliminary.id && definitionMap.has(preliminary.id) ? definitionMap.get(preliminary.id) : {}
                const normalized = normalizeDefinitionInput(definition, existing)
                if (!normalized) {
                    return
                }
                definitionMap.set(normalized.id, normalized)
            }

            upsertDefinition({ id: "free", label: "Free", removable: false })
            upsertDefinition({ id: "premium", label: "Premium", removable: false })

            rewardsList.forEach((reward) => {
                if(!reward || typeof reward !== "object" || !reward.rewards) {
                    return
                }
                Object.keys(reward.rewards).forEach((key) => {
                    upsertDefinition(reward.rewards[key])
                })
            })

            const importedDefinitions = Array.from(definitionMap.values())
            req.session.save(() => {
                req.session.rewardsList = JSON.stringify(rewardsList)
                req.session.trackDefinitions = JSON.stringify(importedDefinitions)
                res.status(200).json(req.session.rewardsList);
            })
        }
        else {
            res.status(400).json("import failed")
        }
    }
    catch (err) {
        console.log(err)
        res.status(500).json(err)
    }
})

router.delete("/", (req, res) => {
    try {
        req.session.destroy()
        res.status(200).json("deleted")
    }
    catch (err) {
        console.log(err)
        res.status(500).json(err)
    }
})

module.exports = router;