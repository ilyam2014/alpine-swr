let table = new WeakMap();

let counter = 0;

export default function hash(args) {
  if (!args.length) return;
  let key = "arg";

  for (let i = 0; i < args.length; i++) {
    let _hash;
    if (args[i] === null || (typeof args[i] !== "object" && typeof args[i] !== "function")) {
      if (typeof args[i] === "string") {
        _hash = '"' + args[i] + '"';
      } else {
        _hash = String(args[i]);
      }
    } else {
      if (!table.has(args[i])) {
        _hash = counter;
        table.set(args[i], counter++);
      } else {
        _hash = table.get(args[i]);
      }
    }
    key += "@" + _hash;
  }
  console.log(key);
  return key;
}
