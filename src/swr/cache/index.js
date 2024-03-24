import hash from "../lib/hash";

function serializeKeyDefault(key) {
  if (typeof key === "function") {
    try {
      key = key();
    } catch {
      key = "";
    }
  }

  if (Array.isArray(key)) {
    key = hash(key);
  } else {
    key = String(key || "");
  }

  return key;
}

export default class SWRVCache {
  constructor(ttl = 0) {
    this.ttl = ttl;
    this.items = new Map();
  }

  serializeKey(key) {
    return serializeKeyDefault(key);
  }

  get(k) {
    return this.items.get(this.serializeKey(k));
  }

  set(k, v, ttl) {
    let key = this.serializeKey(k);
    let timeToLive = this.ttl || ttl;
    let now = Date.now();

    let item = {
      data: v,
      createdAt: now,
      expiresAt: timeToLive ? now + timeToLive : Infinity,
    };

    this.dispatchExpire(timeToLive, item, key);
    this.items.set(key, item);
  }

  dispatchExpire(ttl, item, serializedKey) {
    ttl &&
      setTimeout(() => {
        let current = Date.now();
        let hasExpired = current >= item.expiresAt;
        if (hasExpired) {
          this.delete(serializedKey);
        }
      }, ttl);
  }

  delete(serializedKey) {
    this.items.delete(serializedKey);
  }
}
