console.log("LEGACYDECK: content script loaded")

const script = document.createElement("script")
script.src = browser.runtime.getURL("page.js")
document.documentElement.appendChild(script)

let syncing = false

const observer = new MutationObserver(mutations => {
    console.log(mutations)
    let values: Record<string, string> = {}
    for (const mutation of mutations) {
        if (mutation.attributeName == null) continue
        if (mutation.attributeName.startsWith("data-")) {
            const name = mutation.attributeName.slice("data-".length).replace(/-[a-z]/g, c => c[1].toUpperCase())
            const value = script.dataset[name]
            if (value != null) values[name] = value
        }
    }
    browser.storage.sync.set(values)
})

browser.storage.sync.get().then(r => {
    syncing = true
    for (const [k, v] of Object.entries(r)) {
        script.dataset[k] = v
    }
    script.dataset.loaded = "true"
    observer.observe(script, {
        attributes: true,
    })
})

