const { formatObjectString, formatSpecs, formatPokemonLore } = require("../utils/formatters")

class Reward {
  index = 1
  rewards = {}

  initReward(index, tracks = []) {
    this.index = index
    this.rewards = {}
    const trackList = tracks.length > 0 ? tracks : [
      { id: "free", label: "Free" },
      { id: "premium", label: "Premium" }
    ]
    trackList.forEach((track) => {
      this.ensureTrack(track)
    })
  }

  ensureTrack(trackInput) {
    const { id, label, permission, _permissionDefined } = this.normalizeTrack(trackInput)
    if (!this.rewards[id]) {
      const displayName = `Level ${this.index} ${label} Reward`
      const message = `You Have Claimed Your Level ${this.index} ${label} Reward!`
      this.rewards[id] = {
        id,
        label,
        rewards: [],
        display: {
          item: "minecraft:diamond",
          sprite: false,
          glow: false,
          name: displayName,
          lore: []
        },
        message,
        permission: _permissionDefined ? permission : ""
      }
    } else {
      this.rewards[id].label = label
      this.rewards[id].display.name = `Level ${this.index} ${label} Reward`
      this.rewards[id].message = `You Have Claimed Your Level ${this.index} ${label} Reward!`
      if (_permissionDefined || typeof this.rewards[id].permission === "undefined") {
        this.rewards[id].permission = _permissionDefined ? permission : (this.rewards[id].permission || "")
      }
    }
    if (typeof this.rewards[id].permission === "undefined") {
      this.rewards[id].permission = ""
    }
    return this.rewards[id]
  }

  normalizeTrack(trackInput) {
    if (typeof trackInput === "string") {
      const id = this.normalizeTrackId(trackInput)
      return { id, label: this.formatLabel(trackInput), _permissionDefined: false }
    }

    const labelSource = trackInput && (trackInput.label || trackInput.name || trackInput.id) || ""
    const idSource = trackInput && (trackInput.id || trackInput.name || labelSource) || ""
    const id = this.normalizeTrackId(idSource)
    const label = this.formatLabel(labelSource || id)
    const permissionInfo = this.extractPermission(trackInput)
    const normalized = { id, label, _permissionDefined: permissionInfo.defined }
    if (permissionInfo.defined) {
      normalized.permission = permissionInfo.value
    }
    return normalized
  }

  normalizeTrackId(value) {
    if (!value) {
      return `track_${Object.keys(this.rewards).length + 1}`
    }
    const normalized = value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
    return normalized || `track_${Object.keys(this.rewards).length + 1}`
  }

  formatLabel(value) {
    const stringValue = value ? value.toString() : ""
    if (!stringValue) {
      return "Reward"
    }
    return stringValue
      .replace(/[_\s]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  extractPermission(trackInput) {
    if (!trackInput || typeof trackInput !== "object") {
      return { defined: false, value: "" }
    }
    const candidateKeys = [
      "permission",
      "permissions",
      "perm",
      "perms",
      "permissionNode"
    ]
    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(trackInput, key)) {
        return { defined: true, value: this.normalizePermission(trackInput[key]) }
      }
    }
    return { defined: false, value: "" }
  }

  normalizePermission(value) {
    if (value === undefined || value === null) {
      return ""
    }
    if (Array.isArray(value)) {
      return value
        .map((segment) => this.normalizePermission(segment))
        .filter(Boolean)
        .join(".")
    }
    if (typeof value === "object") {
      if (Object.prototype.hasOwnProperty.call(value, "value")) {
        return this.normalizePermission(value.value)
      }
      if (Object.prototype.hasOwnProperty.call(value, "permission")) {
        return this.normalizePermission(value.permission)
      }
      if (Object.prototype.hasOwnProperty.call(value, "node")) {
        return this.normalizePermission(value.node)
      }
      return Object.values(value)
        .map((segment) => this.normalizePermission(segment))
        .filter(Boolean)
        .join(".")
    }
    if (typeof value === "symbol") {
      return value.toString()
    }
    return value.toString().trim()
  }

  addItem(trackInput, source, item, amount) {
    const track = this.ensureTrack(trackInput)
    track.rewards.push(`give @p ${source}:${item} ${amount}`)
    track.display.item = `${source}:${item}`
    track.display.sprite = false
    track.display.lore.push(`${amount}x ` + formatObjectString(item))
  }

  addPokemon(trackInput, pokemon, specs) {
    const track = this.ensureTrack(trackInput)
    track.rewards.push(`pokegive @p ${pokemon} ${formatSpecs(specs)}`)
    track.display.item = `${pokemon}`
    track.display.sprite = true
    track.display.lore.push(formatPokemonLore(pokemon, specs))
  }

  addCommand(trackInput, command, source, item, lore) {
    const track = this.ensureTrack(trackInput)
    track.rewards.push(`${command}`)
    track.display.item = `${source}:${item}`
    track.display.sprite = false
    track.display.lore.push(lore)
  }
}

module.exports = Reward
