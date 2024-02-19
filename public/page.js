"use strict";
(() => {
    // @ts-expect-error
    const proxyLogger = (o, key) => new Proxy(o, {
        get(target, k) {
            let ret = Reflect.get(target, k);
            console.log(key, k, ret);
            // @ts-expect-error
            if (typeof ret === "object" && ret != null)
                ret = proxyLogger(ret, key + "." + k);
            return ret;
        }
    });
    // @ts-expect-error
    window["proxyLogger"] = proxyLogger;
    const debugLogging = false;
    function generateRandomID(length) {
        const rnd = new Uint32Array(4);
        crypto.getRandomValues(rnd);
        return Array.from(rnd).map(c => c.toString(36)).join("").slice(-length);
    }
    function dateToMtimeString(date) {
        return date.toISOString().slice(0, -1) + "000";
    }
    function parseFromLocalStorage(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) ?? fallback);
        }
        catch (e) {
            console.error(e);
            alert(`FAILED TO READ ${key}`);
            return JSON.parse(fallback);
        }
    }
    const { promise: userIdPromise, resolve: resolveUserId } = Promise.withResolvers();
    const STORAGE_KEYS = {
        COLUMNS: (userId) => `LEGACYDECK:${userId}:COLUMNS`,
        FEEDS: (userId) => `LEGACYDECK:${userId}:FEEDS`,
        SETTINGS_COLUMN_IDS: (userId) => `LEGACYDECK:${userId}:COLUMN_IDS`,
        SETTINGS: (userId) => `LEGACYDECK:${userId}:SETTINGS`,
    };
    window.XMLHttpRequest = new Proxy(window.XMLHttpRequest, {
        construct(target, args, newTarget) {
            if (debugLogging)
                console.log("made new xhr...");
            const xhr = Reflect.construct(target, args, newTarget);
            let xhrDestURL = "";
            let mtime = undefined;
            let overridedRes = undefined;
            return new Proxy(xhr, {
                get(target, key, rec) {
                    if (debugLogging)
                        console.log(xhrDestURL, "get", key);
                    let ret = Reflect.get(target, key, target);
                    if (typeof ret === "function") {
                        ret = ret.bind(xhr);
                    }
                    if (key === "open") {
                        return (function (method, url, ...args) {
                            xhrDestURL = url;
                            if (debugLogging)
                                console.log("opening to", url);
                            return ret(method, url, ...args);
                        });
                    }
                    else if (key === "setRequestHeader") {
                        return function (key, value) {
                            if (debugLogging)
                                console.log(xhrDestURL, "setRequestHeader", key, value);
                            if (key.toLowerCase() === "authorization" && !xhrDestURL.startsWith("https://api.twitter.com/1.1/activity/by_friends.json")) {
                                value = "Bearer AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF";
                            }
                            return ret(key, value);
                        };
                    }
                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/clients/blackbird/all") {
                        if (key === "send") {
                            return function (body) {
                                userIdPromise.then(userId => {
                                    let columns = parseFromLocalStorage(STORAGE_KEYS.COLUMNS(userId), "{}");
                                    let feeds = parseFromLocalStorage(STORAGE_KEYS.FEEDS(userId), "{}");
                                    let settings = parseFromLocalStorage(STORAGE_KEYS.SETTINGS(userId), "{}");
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
                                    });
                                    ret(body);
                                });
                            };
                        }
                        else if (key === "status") {
                            return 200;
                        }
                    }
                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/clients/blackbird") {
                        if (key === "send") {
                            // TODO: permanent save
                            return function (body) {
                                mtime = new Date();
                                const bodyJSON = JSON.parse(body);
                                userIdPromise.then(userId => {
                                    if (bodyJSON.settings)
                                        localStorage.setItem(STORAGE_KEYS.SETTINGS(userId), JSON.stringify(bodyJSON.settings));
                                    if (bodyJSON.columns)
                                        localStorage.setItem(STORAGE_KEYS.SETTINGS_COLUMN_IDS(userId), JSON.stringify(bodyJSON.columns));
                                    console.log("sendbody", body);
                                    ret(body);
                                });
                            };
                        }
                        else if (key === "status") {
                            return 200;
                        }
                        else if (key === "getAllResponseHeaders") {
                            return function () {
                                let r = ret();
                                console.log(r);
                                if (mtime)
                                    r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`;
                                return r;
                            };
                        }
                    }
                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/feeds") {
                        if (key === "send") {
                            return function (body) {
                                const bodyJSON = JSON.parse(body);
                                userIdPromise.then(userId => {
                                    let feeds = parseFromLocalStorage(STORAGE_KEYS.FEEDS(userId), "{}");
                                    mtime = new Date();
                                    const ids = [];
                                    for (const feed of bodyJSON) {
                                        const id = generateRandomID(12);
                                        ids.push(id);
                                        feeds[id] = feed;
                                    }
                                    overridedRes = JSON.stringify(ids);
                                    localStorage.setItem(STORAGE_KEYS.FEEDS(userId), JSON.stringify(feeds));
                                    ret(body);
                                });
                            };
                        }
                        else if (key === "status") {
                            return 200;
                        }
                        else if (key === "getAllResponseHeaders") {
                            return function () {
                                let r = ret();
                                console.log(r);
                                if (mtime)
                                    r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`;
                                return r;
                            };
                        }
                    }
                    if (xhrDestURL === "https://api.twitter.com/1.1/tweetdeck/columns") {
                        if (key === "send") {
                            return function (body) {
                                const bodyJSON = JSON.parse(body);
                                userIdPromise.then(userId => {
                                    let columns = parseFromLocalStorage(STORAGE_KEYS.COLUMNS(userId), "{}");
                                    mtime = new Date();
                                    const ids = [];
                                    for (const feed of bodyJSON) {
                                        const id = generateRandomID(8);
                                        ids.push(id);
                                        columns[id] = feed;
                                    }
                                    overridedRes = JSON.stringify(ids);
                                    localStorage.setItem(STORAGE_KEYS.COLUMNS(userId), JSON.stringify(columns));
                                    ret(body);
                                });
                            };
                        }
                        else if (key === "status") {
                            return 200;
                        }
                        else if (key === "getAllResponseHeaders") {
                            return function () {
                                let r = ret();
                                console.log(r);
                                if (mtime)
                                    r += `x-td-mtime: ${dateToMtimeString(mtime)}\r\n`;
                                return r;
                            };
                        }
                    }
                    if (xhrDestURL === "https://api.twitter.com/1.1/account/verify_credentials.json") {
                        if (key === "send") {
                            return function (...args) {
                                xhr.addEventListener("loadend", () => {
                                    if (xhr.status === 200) {
                                        const json = JSON.parse(xhr.responseText);
                                        if (typeof json.id_str === "string")
                                            resolveUserId(json.id_str);
                                    }
                                });
                                return ret(...args);
                            };
                        }
                    }
                    if (key === "responseText" && overridedRes != null) {
                        return overridedRes;
                    }
                    return ret;
                },
                set(target, key, value) {
                    if (debugLogging)
                        console.log(xhrDestURL, "set", key, value);
                    return Reflect.set(target, key, value);
                },
                apply(target, thisArg, args) {
                }
            });
        }
    });
    document.currentScript?.remove();
})();
