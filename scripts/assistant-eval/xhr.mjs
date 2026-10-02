// XMLHttpRequest over fetch, streaming included: responseText grows and
// onprogress fires as the server's events arrive, as on the phone.
globalThis.__log = [];
globalThis.XMLHttpRequest = class {
  open(m, u) { this.m = m; this.u = u; this.h = {}; this.responseText = ""; }
  setRequestHeader(k, v) { this.h[k] = v; }
  abort() { this.ctrl?.abort(); }
  send(body) {
    globalThis.__log.push(JSON.parse(body));
    this.ctrl = new AbortController();
    fetch(this.u, { method: this.m, headers: this.h, body, signal: this.ctrl.signal })
      .then(async (r) => {
        this.status = r.status;
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          this.responseText += dec.decode(value, { stream: true });
          this.onprogress?.();
        }
        this.onload?.();
      })
      .catch(() => this.onerror?.());
  }
};
