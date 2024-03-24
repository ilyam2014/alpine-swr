import SWRVCache from "..";

export default class LocalStorageCache extends SWRVCache {
  constructor(key = "swrv", ttl = 0) {
    super(ttl);
    this.STORAGE_KEY = key;
  }

  encode(storage) {
    return JSON.stringify(storage);
  }

  decode(storage) {
    return JSON.parse(storage);
  }

  get(k) {
    let item = localStorage.getItem(this.STORAGE_KEY);
    if (item) {
      let _key = this.serializeKey(k);
      let itemParsed = JSON.parse(item)[_key];

      if (itemParsed?.expiresAt === null) {
        itemParsed.expiresAt = Infinity;
      }

      return itemParsed;
    }
    return undefined;
  }

  set(k, v, ttl) {
    let payload = {};
    let _key = this.serializeKey(k);
    let timeToLive = ttl || this.ttl;
    let storage = localStorage.getItem(this.STORAGE_KEY);
    let now = Date.now();
    let item = {
      data: v,
      createdAt: now,
      expiresAt: timeToLive ? now + timeToLive : Infinity,
    };

    if (storage) {
      payload = this.decode(storage);
      payload[_key] = item;
    } else {
      payload = { [_key]: item };
    }

    this.dispatchExpire(timeToLive, item, _key);
    localStorage.setItem(this.STORAGE_KEY, this.encode(payload));
  }

  dispatchExpire(ttl, item, serializedKey) {
    ttl &&
      setTimeout(() => {
        let current = Date.now();
        let hasExpired = current >= item.expiresAt;
        if (hasExpired) this.delete(serializedKey);
      });
  }

  delete(serializedKey) {
    let storage = localStorage.getItem(this.STORAGE_KEY);
    let payload = {};
    if (storage) {
      payload = this.decode(storage);

      delete payload[serializedKey];
    }
    localStorage.setItem(this.STORAGE_KEY, this.encode(payload));
  }
}
