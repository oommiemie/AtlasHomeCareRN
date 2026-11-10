/*
  expo-file-system, for the web build.

  The app keeps its stores (session, notes, visit records, settings) as small
  JSON files on the device. A browser has no such files, so every write threw
  and the store said so: a red "บันทึกลงเครื่องไม่สำเร็จ" was the first thing
  a visitor to the GitHub Pages demo saw. Here a file is a key in
  localStorage, so the stores work as they do on a phone and a demo filled in
  on the web is still there after a reload.

  Only what the app uses: `new File(dir, name)`, `exists`, `create`, `write`,
  `text`, `textSync`, `delete` and `uri`, with `Paths.document` and
  `Paths.cache`. Binary content (the voice answers) is held in memory for the
  page's life, which is all it is needed for.
*/

const PREFIX = "atlas-fs:";
const binary = new Map();

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

class Directory {
  constructor(...parts) {
    this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
  }
  get exists() {
    return true;
  }
  create() {}
}

class File {
  constructor(...parts) {
    this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    this.name = this._uri.split("/").pop();
  }
  get exists() {
    return binary.has(this.key) || storage()?.getItem(this.key) != null;
  }
  create() {
    if (!this.exists) storage()?.setItem(this.key, "");
  }
  write(content) {
    if (typeof content === "string") {
      storage()?.setItem(this.key, content);
      return;
    }
    // Bytes: kept in memory, and handed out as a blob URL.
    const old = binary.get(this.key);
    if (old != null) URL.revokeObjectURL(old.url);
    const blob = new Blob([content]);
    binary.set(this.key, { blob, url: URL.createObjectURL(blob) });
  }
  textSync() {
    return storage()?.getItem(this.key) ?? "";
  }
  async text() {
    return this.textSync();
  }
  delete() {
    storage()?.removeItem(this.key);
    const old = binary.get(this.key);
    if (old != null) URL.revokeObjectURL(old.url);
    binary.delete(this.key);
  }
  get size() {
    return this.textSync().length;
  }
}

// A held blob answers to its blob URL, so an <audio> or <img> can play it.
Object.defineProperty(File.prototype, "uri", {
  configurable: true,
  get() {
    return binary.get(PREFIX + this._uri)?.url ?? this._uri;
  },
  set(v) {
    this._uri = v;
  },
});
Object.defineProperty(File.prototype, "key", {
  configurable: true,
  get() {
    return PREFIX + this._uri;
  },
});

const Paths = {
  document: new Directory("document"),
  cache: new Directory("cache"),
};

module.exports = { File, Directory, Paths };
