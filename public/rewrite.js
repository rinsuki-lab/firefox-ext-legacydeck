// @ts-check
/// <reference types="web-ext-types" />
console.log("LegacyDeck Boot", new Date())

const EXPECTED_SHA512_OF_HTML = "a9f733d3a17586262534de28faf4201bc9674e759730088bd58daaaa667c7855cd9748a6cb5510e30f7338ad2a95b0b9919c6093c8fe84c0579959031d078fc3"

// Replace body with old one
browser.webRequest.onBeforeRequest.addListener(async details => {
    console.log("got", details.url)
    const res = await fetch("https://web.archive.org/web/20221231161219id_/https://tweetdeck.twitter.com/", { credentials: "omit" })
    const resArrayBuffer = await res.arrayBuffer()
    const resArrayBufferHash = await crypto.subtle.digest("SHA-512", resArrayBuffer)
    const resArrayBufferHashString = Array.from(new Uint8Array(resArrayBufferHash)).map(x => x.toString(16).padStart(2, "0")).join("")
    const responseRewriter = browser.webRequest.filterResponseData(details.requestId)
    responseRewriter.onstart = () => {
        if (resArrayBufferHashString === EXPECTED_SHA512_OF_HTML) {
            responseRewriter.write(resArrayBuffer)
            responseRewriter.write(new TextEncoder().encode(`<script src="${browser.runtime.getURL("page.js")}"></script>`))
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
            { name: "x-frame-options", value: "SAMEORIGIN" },
            { name: "content-security-policy", value: [
                "default-src 'self'",
                "connect-src 'self' blob: https://api.twitter.com https://upload.twitter.com https://ton.twimg.com https://api-ssl.bitly.com",
                "font-src 'self' https://ton.twimg.com data:",
                "frame-src https:",
                "img-src https: data:",
                "media-src blob: https://video.twimg.com https://ton.twimg.com",
                "script-src 'self' 'unsafe-eval' https://*.twitter.com https://*.twimg.com https://api-ssl.bitly.com",
                "style-src 'self' 'unsafe-inline' https://platform.twitter.com https://ton.twimg.com"
            ].join("; ")},
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