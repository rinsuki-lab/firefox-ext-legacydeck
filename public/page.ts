(() => {
    const overrider = <K extends string, O extends {[key in K]: (...args: any[]) => any}>(obj: O, name: K, value: (orig: O[K], ...args: Parameters<O[K]>) => ReturnType<O[K]>) => {
        const orig = obj[name]
        // @ts-ignore
        obj[name] = function(...args: Parameters<O[K]>) {
            // @ts-ignore
            return value.call(this, orig.bind(this), ...args)
        }
    }

    const weakMapForRequestURL = new WeakMap<XMLHttpRequest, string>()

    overrider(XMLHttpRequest.prototype, "open", function(this: XMLHttpRequest, orig, method, url, ...args) {
        weakMapForRequestURL.set(this, typeof url === "string" ? url : url.href)
        orig(method, url, ...args)
    })

    overrider(XMLHttpRequest.prototype, "setRequestHeader", function(this: XMLHttpRequest, orig, name, value) {
        const url = weakMapForRequestURL.get(this)
        // Skip TweetDeck exclusive API
        if (url != null && url.startsWith("https://api.twitter.com/1.1/activity/by_friends.json")) {
            orig(name, value)
            return
        }
        if (name.toLowerCase() === "authorization") value = "Bearer AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF"
        orig(name, value)
    })
    document.currentScript?.remove()
})()