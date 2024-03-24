function isOnline() {
  if (typeof navigator.onLine !== "undefined") {
    return navigator.onLine;
  }
  return true;
}

function isDocumentVisible() {
  if (typeof document !== "undefined" && typeof document.visibilityState !== "undefined") {
    return document.visibilityState !== "hidden";
  }
  return true;
}

let fetcher = (url) => fetch(url).then((res) => res.json());

export default {
  isOnline,
  isDocumentVisible,
  fetcher,
};
