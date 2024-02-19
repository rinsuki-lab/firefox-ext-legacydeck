// from https://github.com/microsoft/TypeScript/blob/aef29e400ebd174bd1ccd3a9489194ce9e3df948/src/lib/esnext.promise.d.ts
// Licensed under Apache License 2.0, https://github.com/microsoft/TypeScript/blob/aef29e400ebd174bd1ccd3a9489194ce9e3df948/LICENSE.txt
interface PromiseWithResolvers<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

interface PromiseConstructor {
    /**
     * Creates a new Promise and returns it in an object, along with its resolve and reject functions.
     * @returns An object with the properties `promise`, `resolve`, and `reject`.
     *
     * ```ts
     * const { promise, resolve, reject } = Promise.withResolvers<T>();
     * ```
     */
    withResolvers<T>(): PromiseWithResolvers<T>;
}