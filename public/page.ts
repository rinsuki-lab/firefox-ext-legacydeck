interface Window {
    __LegacyDeckLoaded: number
}

(() => {
const main = (scriptTag: HTMLOrSVGScriptElement) => {
    if (window.XMLHttpRequest.toString().startsWith("function () {")) {
        if (window.__LegacyDeckLoaded != null && (performance.now() - window.__LegacyDeckLoaded) > 1000) {
            location.reload()
            return
        }
        alert("WARNING: someone overriding XMLHttpRequest already (or loading LegacyDeck twice), it might be causes some weird errors.")
        return
    }
    window.__LegacyDeckLoaded = performance.now()
    scriptTag.remove()

    // @ts-expect-error
    const proxyLogger = (o: unknown, key: string) => new Proxy(o, {
        get(target, k) {
            let ret = Reflect.get(target, k)
            console.log(key, k, ret)
            // @ts-expect-error
            if (typeof ret === "object" && ret != null) ret = proxyLogger(ret, key + "." + k)
            return ret
        }
    })

    // @ts-expect-error
    window["proxyLogger" as any] = proxyLogger

    const debugLogging = false

    function generateRandomID(length: number) {
        const rnd = new Uint32Array(2)
        crypto.getRandomValues(rnd)
        return Array.from(rnd).map(c => c.toString(36)).join("").slice(-length)
    }

    function dateToMtimeString(date: Date) {
        return date.toISOString().slice(0, -1) + "000"
    }

    function parseFromLocalStorage(key: string, fallback: string): any {
        try {
            return JSON.parse(scriptTag.dataset[key] ?? fallback)
        } catch(e) {
            console.error(e)
            alert(`FAILED TO READ ${key}`)
            return JSON.parse(fallback)
        }
    }

    function setToStorage(key: ReturnType<typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]>, value: string) {
        scriptTag.dataset[key] = value
        if (debugLogging) console.log(scriptTag)
    }

    const { promise: userIdPromise, resolve: resolveUserId } = Promise.withResolvers<string>()

    const STORAGE_KEYS = {
        COLUMNS: (userId: string) => `LEGACYDECK:${userId}:COLUMNS` as const,
        FEEDS: (userId: string) => `LEGACYDECK:${userId}:FEEDS` as const,
        SETTINGS_COLUMN_IDS: (userId: string) => `LEGACYDECK:${userId}:COLUMN_IDS` as const,
        SETTINGS: (userId: string) => `LEGACYDECK:${userId}:SETTINGS` as const,
    }
    
    window.XMLHttpRequest = new Proxy(window.XMLHttpRequest, {
        construct(target, args, newTarget) {
            if (debugLogging) console.log("made new xhr...")
            const xhr = Reflect.construct(target, args, newTarget) as XMLHttpRequest
            let xhrDestURL = ""
            let mtime: Date | undefined = undefined
            let overridedRes: string | undefined = undefined
            return new Proxy(xhr, {
                get<T extends keyof typeof xhr>(target: typeof xhr, key: T, rec: any) {
                    if (debugLogging) console.log(xhrDestURL, "get", key)
                    let ret = Reflect.get(target, key, target) as typeof xhr[T]
                    if (typeof ret === "function") {
                        ret = ret.bind(xhr)
                    }

                    if (key === "open") {
                        return (function(this: XMLHttpRequest, method: string, url: string, ...args: unknown[]) {
                            xhrDestURL = url
                            if (debugLogging) console.log("opening to", url)
                            return ret(method, url, ...args)
                        })
                    } else if (key === "setRequestHeader") {
                        return function(key: string, value: string) {
                            if (debugLogging) console.log(xhrDestURL, "setRequestHeader", key, value)
                            if (key.toLowerCase() === "authorization" && !xhrDestURL.startsWith("https://api.twitter.com/1.1/activity/by_friends.json")) {
                                value = "Bearer AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF"
                            }
                            return ret(key, value)
                        }
                    }

                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/clients/blackbird/all") {
                        if (key === "send") {
                            return function(body: unknown) {
                                userIdPromise.then(userId => {
                                    let columns = parseFromLocalStorage(STORAGE_KEYS.COLUMNS(userId), "{}")
                                    let feeds = parseFromLocalStorage(STORAGE_KEYS.FEEDS(userId), "{}")
                                    let settings = parseFromLocalStorage(STORAGE_KEYS.SETTINGS(userId), "{}")
                                    overridedRes = JSON.stringify({
                                        // accounts: [],
                                        feeds,
                                        columns,
                                        client: {
                                            columns: parseFromLocalStorage(STORAGE_KEYS.SETTINGS_COLUMN_IDS(userId), "[]"),
                                            mtime: dateToMtimeString(new Date()),
                                            settings: {
                                                account_whitelist: [],
                                                ...settings,
                                            },
                                            name: "blackbird",
                                        },
                                    })
    
                                    ret(body)
                                })
                            }
                        } else if (key === "status") {
                            return 200
                        }
                    }

                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/clients/blackbird") {
                        if (key === "send") {
                            // TODO: permanent save
                            return function(body: string) {
                                mtime = new Date()
                                const bodyJSON = JSON.parse(body)
                                userIdPromise.then(userId => {
                                    if (bodyJSON.settings) setToStorage(STORAGE_KEYS.SETTINGS(userId), JSON.stringify(bodyJSON.settings))
                                    if (bodyJSON.columns) setToStorage(STORAGE_KEYS.SETTINGS_COLUMN_IDS(userId), JSON.stringify(bodyJSON.columns))
                                    console.log("sendbody", body)
                                    ret(body)
                                })
                            }
                        } else if (key === "status") {
                            return 200
                        } else if (key === "getAllResponseHeaders") {
                            return function() {
                                let r = ret()
                                console.log(r)
                                if (mtime) r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`
                                return r
                            }
                        }
                    }
                    
                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/feeds") {
                        if (key === "send") {
                            return function(body: string) {
                                const bodyJSON = JSON.parse(body)

                                userIdPromise.then(userId => {
                                    let feeds: Record<string, unknown> = parseFromLocalStorage(STORAGE_KEYS.FEEDS(userId), "{}")

                                    mtime = new Date()
                                    const ids = []
                                    for (const feed of bodyJSON) {
                                        const id = generateRandomID(12)
                                        ids.push(id)
                                        feeds[id] = feed
                                    }
                                    overridedRes = JSON.stringify(ids)

                                    setToStorage(STORAGE_KEYS.FEEDS(userId), JSON.stringify(feeds))
                                    ret(body)
                                })
                            }
                        } else if (key === "status") {
                            return 200
                        } else if (key === "getAllResponseHeaders") {
                            return function() {
                                let r = ret()
                                console.log(r)
                                if (mtime) r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`
                                return r
                            }
                        }
                    }

                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/columns") {
                        if (key === "send") {
                            return function(body: string) {
                                const bodyJSON = JSON.parse(body)

                                userIdPromise.then(userId => {
                                    let columns: Record<string, unknown> = parseFromLocalStorage(STORAGE_KEYS.COLUMNS(userId), "{}")
    
                                    mtime = new Date()
                                    const ids = []
                                    for (const feed of bodyJSON) {
                                        const id = generateRandomID(8)
                                        ids.push(id)
                                        columns[id] = feed
                                    }
                                    overridedRes = JSON.stringify(ids)
                                    setToStorage(STORAGE_KEYS.COLUMNS(userId), JSON.stringify(columns))

                                    ret(body)
                                })
                            }
                        } else if (key === "status") {
                            return 200
                        } else if (key === "getAllResponseHeaders") {
                            return function() {
                                let r = ret()
                                console.log(r)
                                if (mtime) r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`
                                return r
                            }
                        }
                    }

                    if (xhrDestURL === "https://api.twitter.com/1.1/account/verify_credentials.json") {
                        if (key === "send") {
                            return function(...args: unknown[]) {
                                xhr.addEventListener("loadend", () => {
                                    if (xhr.status === 200) {
                                        const json = JSON.parse(xhr.responseText)
                                        if (typeof json.id_str === "string") resolveUserId(json.id_str)
                                    }
                                })
                                return ret(...args)
                            }
                        }
                    }

                    if (key === "responseText" && overridedRes != null) {
                        return overridedRes
                    }

                    return ret
                },
                set(target, key, value) {
                    if (debugLogging) console.log(xhrDestURL, "set", key, value)
                    return Reflect.set(target, key, value)
                },
                apply(target, thisArg, args) {
                }
            })
        }
    })
}

const cs = document.currentScript
if (cs != null) {
    main(cs)
} else {
    alert("LegacyDeck(page): script tag not found")
}
    
})()
