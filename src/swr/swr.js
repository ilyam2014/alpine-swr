import SWRVCache from "./cache";
import webPreset from "./lib/web-preset";
import {Alpine} from '../../../vendor/livewire/livewire/dist/livewire.esm';

const DATA_CACHE = new SWRVCache();
const REF_CACHE = new SWRVCache();
const PROMISES_CACHE = new SWRVCache();

let defaultConfig = {
    cache: DATA_CACHE,
    refreshInterval: 0,
    ttl: 0,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateDebounce: 0,
    shouldRetryOnError: true,
    errorRetryInterval: 5000,
    errorRetryCount: 5,
    fetcher: webPreset.fetcher,
    isOnline: webPreset.isOnline,
    isDocumentVisible: webPreset.isDocumentVisible,
};

function setRefCache(key, theRef, ttl) {
    let refCacheItem = REF_CACHE.get(key);
    if (refCacheItem) {
        refCacheItem.data.push(theRef);
    } else {
        let gracePeriod = 5000;
        REF_CACHE.set(key, [theRef], ttl > 0 ? ttl + gracePeriod : ttl);
    }
}

function onErrorRetry(revalidate, errorRetryCount, config) {
    if (!config.isDocumentVisible()) return;

    if (config.errorRetryCount !== undefined && errorRetryCount > config.errorRetryCount) return;

    let count = Math.min(errorRetryCount || 0, config.errorRetryCount);
    let timeout = count * config.errorRetryInterval;
    setTimeout(() => {
        revalidate(null, {
            errorRetryCount: count + 1,
            shouldRetryOnError: true,
        });
    }, timeout);
}

async function mutate(key, res, cache, ttl) {
    let data, error, isValidating;
    if (isPromise(res)) {
        try {
            data = await res;
        } catch (err) {
            error = err;
        }
    } else {
        data = res;
    }

    isValidating = false;

    let newData = {data, error, isValidating};

    if (typeof data !== "undefined") {
        try {
            cache.set(key, newData, ttl);
        } catch (err) {
            console.error("swr(mutate): failed to set cache", err);
        }
    }

    let stateRef = REF_CACHE.get(key);
    if (stateRef && stateRef.data.length) {
        let refs = stateRef.data.filter((r) => r.key === key);

        refs.forEach((r, idx) => {
            if (typeof newData.data !== "undefined") {
                r.data = newData.data;
            }
            r.error = newData.error;
            r.isValidating = newData.isValidating;

            let isLast = idx === refs.length - 1;
            if (!isLast) {
                delete refs[idx];
            }
        });

        refs = refs.filter(Boolean);
    }
    return newData;
}

function swr(onMount, onDestroy, ...args) {
    let key;
    let fn;
    let config = {...defaultConfig};
    let unmounted = false;


    if (args.length >= 1) {
        key = args[0];
    }
    if (args.length >= 2) {
        fn = args[1];
    }
    if (args.length > 2) {
        config = {
            ...config,
            ...args[2],
        };
    }

    let ttl = config.ttl;
    let keyRef = Alpine.reactive({value: typeof key === 'function' ? key() : key})

    if (typeof fn === "undefined") {
        fn = config.fetcher;
    }

    let stateRef = Alpine.reactive({
        data: undefined,
        error: undefined,
        isValidating: true,
        key: null,
    });


    async function revalidate(data, opts) {
        let isFirstFetch = stateRef.data === undefined;
        let keyVal = keyRef.value;
        if (!keyVal) return;
        let cacheItem = config.cache.get(keyVal);
        let newData = cacheItem && cacheItem.data;
        stateRef.isValidating = true;

        if (newData) {
            stateRef.data = newData.data;
            stateRef.error = newData.error;
        }

        let fetcher = data || fn;
        if (!fetcher || (!config.isDocumentVisible() && !isFirstFetch) || (opts?.forceRevalidate !== undefined && !opts.forceRevalidate)) {
            stateRef.isValidating = false;
            return;
        }

        if (cacheItem) {
            let shouldRevalidate = Boolean(Date.now() - cacheItem.createdAt >= config.dedupingInterval || opts?.forceRevalidate);
            if (!shouldRevalidate) {
                stateRef.isValidating = false;
                return;
            }
        }

        async function trigger() {
            let promiseFromCache = PROMISES_CACHE.get(keyVal);
            if (!promiseFromCache) {
                let fetcherArgs = Array.isArray(keyVal) ? keyVal : [keyVal];
                let newPromise = fetcher(...fetcherArgs);
                PROMISES_CACHE.set(keyVal, newPromise, config.dedupingInterval);
                await mutate(keyVal, newPromise, config.cache, ttl);
            } else {
                await mutate(keyVal, promiseFromCache.data, config.cache, ttl);
            }
            stateRef.isValidating = false;
            PROMISES_CACHE.delete(keyVal);
            if (stateRef.error !== undefined) {
                let shouldRetryOnError = !unmounted && config.shouldRetryOnError && (opts ? opts.shouldRetryOnError : true);
                if (shouldRetryOnError) {
                    onErrorRetry(revalidate, opts ? opts.errorRetryCount : 1, config);
                }
            }
        }

        if (newData && config.revalidateDebounce) {
            setTimeout(async () => {
                if (!unmounted) {
                    await trigger();
                }
            }, config.revalidateDebounce);
        } else {
            await trigger();
        }
    }

    async function revalidateCall() {
        revalidate(null, {shouldRetryOnError: false});
    }

    let timer = null;
    onMount(() => {

        let tick = async () => {
            if (!stateRef.error && config.isOnline()) {
                await revalidate();
            } else {
                if (timer) {
                    clearTimeout(timer);
                }
            }

            if (config.refreshInterval && !unmounted) {
                timer = setTimeout(tick, config.refreshInterval);
            }
        };

        if (config.refreshInterval) {
            timer = setTimeout(tick, config.refreshInterval);
        }

        if (config.revalidateOnFocus) {
            document.addEventListener("visibilitychange", revalidateCall, false);
            window.addEventListener("focus", revalidateCall, false);
        }
    });

    onDestroy(() => {
        unmounted = true;
        if (timer) clearTimeout(timer);

        if (config.revalidateOnFocus) {
            document.removeEventListener("visibilitychange", revalidateCall, false);
            window.removeEventListener("focus", revalidateCall, false);

            let refCacheItem = REF_CACHE.get(keyRef.value);

            if (refCacheItem) {
                refCacheItem.data = refCacheItem.data.filter((ref) => ref !== stateRef);
            }
        }
    });

    function _watchHandler(val) {
        keyRef.value = val;
        stateRef.key = val;
        stateRef.isValidating = Boolean(val);
        setRefCache(keyRef.value, stateRef, ttl);
        if (keyRef.value) {
            revalidate();
        }
    }

    try {
        Alpine.watch(
            () => keyRef,
            (val) => _watchHandler(val),
        );
        _watchHandler(keyRef.value)
    } catch (err) {
        console.log(err)
    }
    let res = stateRef
    res.mutate = (data, opts) =>
        revalidate(data, {
            ...opts,
            forceRevalidate: true,
        })
    return res
}

function isPromise(p) {
    return p !== null && typeof p === "object" && typeof p.then === "function";
}

export {mutate};
export default swr;
