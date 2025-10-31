let jsonShowing = false;
let importShowing = false;
let trackCounter = 0;

const defaultTracks = [
    { id: 'free', label: 'Free', removable: false, permission: '' },
    { id: 'premium', label: 'Premium', removable: false, permission: '' }
]

const baseTrackIds = { free: true, premium: true }

function normalizePermissionValue(value) {
    if (value === undefined || value === null) {
        return ''
    }
    if (Array.isArray(value)) {
        return value
            .map((segment) => normalizePermissionValue(segment))
            .filter(Boolean)
            .join('.')
    }
    if (typeof value === 'object') {
        if (Object.prototype.hasOwnProperty.call(value, 'value')) {
            return normalizePermissionValue(value.value)
        }
        if (Object.prototype.hasOwnProperty.call(value, 'permission')) {
            return normalizePermissionValue(value.permission)
        }
        if (Object.prototype.hasOwnProperty.call(value, 'node')) {
            return normalizePermissionValue(value.node)
        }
        return Object.values(value)
            .map((segment) => normalizePermissionValue(segment))
            .filter(Boolean)
            .join('.')
    }
    if (typeof value === 'symbol') {
        return value.toString()
    }
    return value.toString().trim()
}

function resolvePermission(source, fallbackPermission) {
    if (source && typeof source === 'object') {
        const candidateKeys = ['permission', 'permissions', 'perm', 'perms', 'permissionNode']
        for (const key of candidateKeys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                return normalizePermissionValue(source[key])
            }
        }
    }
    if (fallbackPermission !== undefined && fallbackPermission !== null) {
        return normalizePermissionValue(fallbackPermission)
    }
    return ''
}

function sanitizeTrackDefinition(track, fallback = {}) {
    const source = track && typeof track === 'object' ? track : {}
    const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
    let id = ''
    if (Object.prototype.hasOwnProperty.call(source, 'id')) {
        id = source.id === undefined || source.id === null ? '' : source.id.toString().trim()
    }
    if (!id && Object.prototype.hasOwnProperty.call(fallbackSource, 'id')) {
        const fallbackId = fallbackSource.id === undefined || fallbackSource.id === null ? '' : fallbackSource.id.toString().trim()
        id = fallbackId
    }
    let label = ''
    if (Object.prototype.hasOwnProperty.call(source, 'label') && source.label) {
        label = source.label.toString()
    } else if (Object.prototype.hasOwnProperty.call(source, 'name') && source.name) {
        label = source.name.toString()
    }
    if (!label && fallbackSource.label) {
        label = fallbackSource.label.toString()
    }
    const permission = resolvePermission(source, fallbackSource.permission)
    let removable
    if (Object.prototype.hasOwnProperty.call(source, 'removable') && typeof source.removable === 'boolean') {
        removable = source.removable
    } else if (Object.prototype.hasOwnProperty.call(fallbackSource, 'removable') && typeof fallbackSource.removable === 'boolean') {
        removable = fallbackSource.removable
    } else if (id) {
        removable = !baseTrackIds[id]
    } else {
        removable = true
    }
    return {
        id,
        label,
        permission,
        removable
    }
}

function readInitialTrackDefinitions() {
    if (Array.isArray(window.initialTrackDefinitions)) {
        return window.initialTrackDefinitions
    }
    const element = document.getElementById('track-definitions-data')
    if (!element) {
        window.initialTrackDefinitions = []
        return []
    }
    try {
        const content = element.textContent || element.innerText || '[]'
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
            window.initialTrackDefinitions = parsed
            return parsed
        }
    } catch (err) {
        window.initialTrackDefinitions = []
        return []
    }
    window.initialTrackDefinitions = []
    return []
}

function getInitialTrackList() {
    const initial = readInitialTrackDefinitions()
    const tracks = []
    const seen = new Set()
    initial.forEach((rawTrack) => {
        const sanitized = sanitizeTrackDefinition(rawTrack)
        if (!sanitized) {
            return
        }
        let id = sanitized.id
        if (!id) {
            id = slugify(sanitized.label)
        }
        if (!id) {
            id = `track_${tracks.length + 1}`
        }
        if (seen.has(id)) {
            return
        }
        let label = sanitized.label
        if (!label) {
            label = labelFromId(id)
        }
        const permission = typeof sanitized.permission === 'string' ? sanitized.permission : ''
        const removable = typeof sanitized.removable === 'boolean' ? sanitized.removable : !baseTrackIds[id]
        tracks.push({ id, label, permission, removable })
        seen.add(id)
    })
    defaultTracks.forEach((track) => {
        if (!seen.has(track.id)) {
            tracks.push({ ...track })
            seen.add(track.id)
        }
    })
    return tracks
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function slugify(value) {
    if (!value) {
        return ''
    }
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

function labelFromId(value) {
    const source = value ? value.toString() : ''
    if (!source) {
        return 'Reward'
    }
    return source
        .replace(/[_\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function readInputValue(input) {
    if(!input || !input.length) {
        return ''
    }
    const rawValue = input.val()
    if(rawValue === undefined || rawValue === null) {
        return ''
    }
    if(Array.isArray(rawValue)) {
        return rawValue
            .map((entry) => entry === undefined || entry === null ? '' : entry.toString().trim())
            .filter(Boolean)
            .join(', ')
    }
    if(typeof rawValue === 'object') {
        return JSON.stringify(rawValue)
    }
    return rawValue.toString().trim()
}

function createTrackCard(track) {
    const { id, label, removable = true, permission = '' } = track
    const wrapper = $('<div class="col s12 track-wrapper"></div>')
    const card = $(
        '<div class="card blue lighten-2 track-card">\
            <div class="card-content">\
                <div class="row track-header">\
                    <div class="input-field col s12 m6 l5">\
                        <input type="text" class="track-name" placeholder="Track Name">\
                    </div>\
                    <div class="input-field col s12 m4 l4 track-permission-field">\
                        <input type="text" class="track-input track-permission" data-field="permission" placeholder="Permission Node">\
                    </div>\
                    <div class="col s12 m2 l3 right-align track-actions">\
                        <button type="button" class="btn-flat waves-effect removeTrackBtn red-text text-darken-1">Remove</button>\
                    </div>\
                </div>\
                <div class="row">\
                    <div class="col s12 m4 red accent-1">\
                        <span>Add item</span>\
                        <div class="row">\
                            <div class="input-field col s6">\
                                <input placeholder="Item Name" type="text" class="track-input" data-field="itemName">\
                            </div>\
                            <div class="input-field col s6">\
                                <input placeholder="Count" type="text" class="track-input" data-field="itemCount">\
                            </div>\
                        </div>\
                        <div class="row">\
                            <div class="input-field col s12">\
                                <select class="track-input" data-field="itemType">\
                                    <option value="minecraft" selected>Minecraft</option>\
                                    <option value="pixelmon">Pixelmon</option>\
                                    <option value="hellasforms">Hellasforms</option>\
                                </select>\
                                <label>Item Source</label>\
                            </div>\
                        </div>\
                    </div>\
                    <div class="col s12 m4 pink accent-1">\
                        <span>Add Command</span>\
                        <div class="row">\
                            <div class="input-field col s12">\
                                <input placeholder="Command" type="text" class="track-input" data-field="commandText">\
                            </div>\
                            <div class="input-field col s6">\
                                <select class="track-input" data-field="commandItemType">\
                                    <option value="minecraft" selected>Minecraft</option>\
                                    <option value="pixelmon">Pixelmon</option>\
                                    <option value="hellasforms">Hellasforms</option>\
                                </select>\
                                <label>Item Source</label>\
                            </div>\
                            <div class="input-field col s6">\
                                <input placeholder="Item Name" type="text" class="track-input" data-field="commandItem">\
                            </div>\
                            <div class="input-field col s12">\
                                <input placeholder="Item Lore" type="text" class="track-input" data-field="commandLore">\
                            </div>\
                        </div>\
                    </div>\
                    <div class="col s12 m4 purple accent-1">\
                        <span>Add Pokemon</span>\
                        <div class="row">\
                            <div class="input-field col s6">\
                                <input placeholder="Pokemon" type="text" class="track-input" data-field="pokemon">\
                            </div>\
                            <div class="input-field col s6">\
                                <input placeholder="Custom Texture" type="text" class="track-input" data-field="texture">\
                            </div>\
                            <div class="input-field col s6">\
                                <input placeholder="Level" type="text" class="track-input" data-field="level">\
                            </div>\
                            <div class="input-field col s6">\
                                <input placeholder="Min IV %" type="text" class="track-input" data-field="miniv">\
                            </div>\
                            <div class="input-field col s12">\
                                <input placeholder="Nature" type="text" class="track-input" data-field="nature">\
                            </div>\
                        </div>\
                    </div>\
                </div>\
            </div>\
        </div>'
    )

    const normalizedId = id || `track_${trackCounter + 1}`
    wrapper.attr('data-track-id', normalizedId)
    wrapper.attr('data-track-label', label || '')
    wrapper.attr('data-track-removable', removable ? 'true' : 'false')
    wrapper.attr('data-track-permission', permission || '')
    card.find('.track-name').val(label || '')
    card.find('.track-permission').val(permission || '')
    if (!removable) {
        card.find('.removeTrackBtn').addClass('disabled hide').attr('disabled', true)
    }
    wrapper.append(card)
    trackCounter += 1
    return wrapper
}

function addTrack(track = {}) {
    const tracksContainer = $('.tracksContainer')
    const card = createTrackCard(track)
    tracksContainer.append(card)
    card.find('select').each(function(_index, element) {
        M.FormSelect.init(element)
    })
}

function initializeTracks() {
    const tracksContainer = $('.tracksContainer')
    if (!tracksContainer.length) {
        return
    }
    tracksContainer.empty()
    trackCounter = 0
    const tracks = getInitialTrackList()
    tracks.forEach((track) => addTrack(track))
}

function collectTrackData() {
    const tracks = []
    $('.track-wrapper').each(function() {
        const wrapper = $(this)
        const card = wrapper.find('.track-card')
        const nameInput = card.find('.track-name')
        const enteredName = readInputValue(nameInput)
        const existingId = wrapper.attr('data-track-id') || ''
        const labelSource = enteredName || wrapper.attr('data-track-label') || labelFromId(existingId)
        let generatedId = slugify(enteredName)
        if (!generatedId) {
            generatedId = existingId || slugify(labelSource)
        }
        let label = labelSource || labelFromId(generatedId)
        if (!generatedId) {
            generatedId = slugify(label)
        }
        if (!generatedId) {
            generatedId = `track_${tracks.length + 1}`
        }
        if (!label) {
            label = labelFromId(generatedId)
        }
        wrapper.attr('data-track-id', generatedId)
        wrapper.attr('data-track-label', label)

        const track = { id: generatedId, label }

        const permission = readInputValue(card.find('.track-permission'))
        track.permission = permission
        wrapper.attr('data-track-permission', permission)

        const itemName = readInputValue(card.find('[data-field="itemName"]'))
        if(itemName) {
            track.itemName = itemName
            track.itemCount = readInputValue(card.find('[data-field="itemCount"]'))
            track.itemType = readInputValue(card.find('[data-field="itemType"]'))
        }

        const commandText = readInputValue(card.find('[data-field="commandText"]'))
        if(commandText) {
            track.commandText = commandText
            track.commandItem = readInputValue(card.find('[data-field="commandItem"]'))
            track.commandItemType = readInputValue(card.find('[data-field="commandItemType"]'))
            track.commandLore = readInputValue(card.find('[data-field="commandLore"]'))
        }

        const pokemon = readInputValue(card.find('[data-field="pokemon"]'))
        if(pokemon) {
            track.pokemon = pokemon
            track.texture = readInputValue(card.find('[data-field="texture"]'))
            track.level = readInputValue(card.find('[data-field="level"]'))
            track.miniv = readInputValue(card.find('[data-field="miniv"]'))
            track.nature = readInputValue(card.find('[data-field="nature"]'))
        }

        tracks.push(track)
    })
    return tracks
}

async function postReward (event) {
    event.preventDefault()
    const tracks = collectTrackData()
    const postBody = {
        tracks,
        index: $(".index").val()
    }

    const response = await fetch('/api/rewards', {
        method: 'POST',
        body: JSON.stringify(postBody),
        headers: { 'Content-Type': 'application/json' }
    })
    if(response.ok) {
        document.location.reload()
    }

}

async function submitImport(event) {
    event.preventDefault()
    let importText = await $("#importText").val()
    if(isJsonString(importText)) {
        importText = JSON.parse(importText)
        const response = await fetch("/api/rewards/import", {
            method: "POST",
            body: JSON.stringify(importText),
            headers: { 'Content-Type': 'application/json' }
        })
        if(response.ok) {
            document.location.reload()
        }
        else {
            alert("Json Import Failed");
            return;
        }
    }
    else {
        alert("Not a valid JSON object");
        return;
    }
}

async function clearAll() {
    const response = await fetch('/api/rewards', {
        method: 'DELETE'
    })
    if(response.ok) {
        document.location.reload()
    }
}

function copyJson() {
    const jsonText = $(".jsonText").val()
    $(".jsonText").select()
    console.log("copied")
    document.execCommand("copy")
}

function toggleView() {
    const jsonView = $(".jsonView")
    const viewBtn = $(".viewBtn")
    if(importShowing) {
        toggleImport()
    }
    if(jsonShowing) {
        jsonView.addClass("hide")
        viewBtn.html("View/Copy Json")
        jsonShowing = false
    }
    else {
        jsonView.removeClass("hide")
        viewBtn.html("Hide Json")
        jsonShowing = true
    }
}

function toggleImport() {
    if(jsonShowing) {
        toggleView()
    }
    const importView = $(".importView")
    const importBtn = $(".importBtn")
    if(importShowing) {
        importView.addClass("hide")
        importBtn.html("Import JSON")
        importShowing = false
    }
    else {
        importView.removeClass("hide")
        importBtn.html("Cancel Import")
        importShowing = true
    }
}





const rewardForm = $(".rewardForm")
rewardForm.bind('submit', postReward)

const clearBtn = $(".clearBtn")
clearBtn.bind('click', clearAll)

const viewBtn = $(".viewBtn")
viewBtn.bind('click', toggleView)

const importBtn = $(".importBtn")
importBtn.bind('click', toggleImport)

const importForm = $(".importForm")
importForm.bind('submit', submitImport)

const copyBtn = $(".copyBtn")
copyBtn.bind("click", copyJson)

const addTrackBtn = $(".addTrackBtn")
addTrackBtn.bind('click', () => addTrack({}))

$(document).on('click', '.removeTrackBtn', function() {
    const wrapper = $(this).closest('.track-wrapper')
    if(wrapper.attr('data-track-removable') === 'false') {
        return
    }
    wrapper.remove()
})

initializeTracks()
