// @ts-check
/// <reference types="web-ext-types" />
console.log("LegacyDeck Boot", new Date())

/** @type {Map<string, Headers>} */
const map = new Map()

const EXPECTED_SHA512_OF_HTML = "a9f733d3a17586262534de28faf4201bc9674e759730088bd58daaaa667c7855cd9748a6cb5510e30f7338ad2a95b0b9919c6093c8fe84c0579959031d078fc3"

// Replace body with old one
browser.webRequest.onBeforeRequest.addListener(async details => {
    console.log("got", details.url)
    const res = await fetch("https://web.archive.org/web/20221231161219id_/https://tweetdeck.twitter.com/", { credentials: "omit" })
    map.set(details.requestId, res.headers)
    const resArrayBuffer = await res.arrayBuffer()
    const resArrayBufferHash = await crypto.subtle.digest("SHA-512", resArrayBuffer)
    const resArrayBufferHashString = Array.from(new Uint8Array(resArrayBufferHash)).map(x => x.toString(16).padStart(2, "0")).join("")
    const responseRewriter = browser.webRequest.filterResponseData(details.requestId)
    responseRewriter.onstart = () => {
        if (resArrayBufferHashString === EXPECTED_SHA512_OF_HTML) {
            responseRewriter.write(resArrayBuffer)
        } else {
            responseRewriter.write(new TextEncoder().encode("Error: Failed to verify assets from web.archive.org.<br>from LegacyDeck Extension"))
        }
        responseRewriter.close()
        console.log("rewrite")
    }
}, {
    urls: ["https://tweetdeck.twitter.com/"]
}, ["blocking"])

// Replace header with old one
browser.webRequest.onHeadersReceived.addListener(details => {
    console.log("rewriting header")
    const ret = {
        responseHeaders: [
            { name: "content-type", value: "text/html; charset=UTF-8" },
            ...Array.from(map.get(details.requestId)).map(([name_, value]) => {
                const name = name_.toLowerCase()
                if (!name.startsWith("x-archive-orig-")) return null
                if (name === "x-archive-orig-content-length") return null
                return { name: name.slice("x-archive-orig-".length), value }
            }).filter(x => x != null),
        ],
        // responseHeaders: [{name: "location", value: "https://tweetdeck.twitter.com/#"}]
    }
    console.log(ret)
    return ret

}, {
    urls: ["https://tweetdeck.twitter.com/"],
}, ["blocking", "responseHeaders"])

// Replace decider response
browser.webRequest.onBeforeRequest.addListener(async details => {
    console.log("got decider")
    return {
        redirectUrl: browser.runtime.getURL("decider.json"),
    }
}, {
    urls: ["https://tweetdeck.twitter.com/decider?*"]
}, ["blocking"])

// Replace version response
browser.webRequest.onBeforeRequest.addListener(async details => {
    console.log("got decider")
    return {
        redirectUrl: browser.runtime.getURL("version.json"),
    }
}, {
    urls: ["https://tweetdeck.twitter.com/web/dist/version.json?t=*"]
}, ["blocking"])