(() => {
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
    
    window.XMLHttpRequest = new Proxy(window.XMLHttpRequest, {
        construct(target, args, newTarget) {
            if (debugLogging) console.log("made new xhr...")
            const xhr = Reflect.construct(target, args, newTarget) as XMLHttpRequest
            let xhrDestURL = ""
            let mtime: number | undefined = undefined
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
                        if (key === "status") {
                            return 200
                        } else if (key === "responseText") {
                            let lsItem: any = {}
                            try {
                                lsItem = JSON.parse(localStorage.getItem("LEGACYDECK_BLACKBIRD") ?? "{}")
                            } catch(e) {
                                alert("WARN: failed to load settings from localStorage")
                            }
                            let lsFeeds = []
                            try {
                                lsFeeds = JSON.parse(localStorage.getItem("LEGACYDECK_FEEDS") ?? "[]")
                            } catch(e) {
                                alert("WARN: failed to load feeds from localStorage")
                            }
                            if (!Array.isArray(lsFeeds)) {
                                alert("WARN: feeds is not array")
                            }
                            return JSON.stringify({
                                // accounts: [],
                                feeds: lsFeeds,
                                // columns: [],
                                client: {
                                    mtime: Date.now(),
                                    settings: {
                                        account_whitelist: [],
                                    },
                                    name: "blackbird",
                                    ...lsItem,
                                },
                            })
                        }
                    }

                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/clients/blackbird") {
                        if (key === "send") {
                            // TODO: permanent save
                            mtime = Date.now()
                            // return function(body: string) {
                            //     mtime = Date.now(),
                            //     localStorage.setItem("LEGACYDECK_BLACKBIRD", JSON.stringify({
                            //         ...JSON.parse(body),
                            //         mtime,
                            //     }))
                            //     console.log("sendbody", body)
                            //     return ret(body)
                            // }
                        }
                        if (key === "status") {
                            return 200
                        } else if (key === "getAllResponseHeaders") {
                            return function() {
                                let r = ret()
                                console.log(r)
                                if (mtime) r += `x-td-mtime: ${mtime}\r\n`
                                return r
                            }
                        }
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
    const div = document.createElement("div")
    div.style.position = "fixed"
    div.style.right = "8px"
    div.style.bottom = "8px"
    div.style.maxWidth = "90vw"
    div.style.background = "white"
    div.style.border = "1px solid black"
    div.style.zIndex = "calc(Infinity - 0)"
    div.style.padding = "1em"
    div.innerHTML = "カラム情報などを同期するAPIが停止されたため、現在カラム情報がリロードするたびに初期化されます。<br>現在カラム情報の永続化をするための調査をしていますが、以前設定されていたカラム情報をサルベージすることはできません。"
    const button = document.createElement("button")
    button.textContent = "わかったので閉じる"
    button.style.display = "block"
    button.addEventListener("click", () => {
        div.remove()
    })
    div.appendChild(button)
    document.body.appendChild(div)

    document.currentScript?.remove()
})()
