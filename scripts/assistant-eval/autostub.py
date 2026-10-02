import re,sys,os
d=sys.argv[1]; p=os.path.join(d,"all.mjs"); s=open(p).read()
P='''const P = new Proxy(function(){ return P }, { get: (t,k) => k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : P, apply: () => P, construct: () => P });\n'''
def fix(m):
    names, mod = m.group(1), m.group(2)
    if mod.startswith("./"): return m.group(0)
    if mod in ("expo-file-system","expo-localization","react"): return m.group(0)
    safe=re.sub(r'[^a-z0-9]','_',mod.lower())
    f=f"auto_{safe}.mjs"; path=os.path.join(d,f)
    exports=set()
    for part in re.findall(r'\{([^}]*)\}', names):
        for n in part.split(","):
            n=n.strip().split(" as ")[0].strip()
            if n: exports.add(n)
    body=P+"".join(f"export const {n} = P;\n" for n in sorted(exports))+"export default P;\n"
    old=open(path).read() if os.path.exists(path) else ""
    if mod=="react-native" and not old:
        old=P+open(os.path.join(d,"stub-rn.mjs")).read()+"\nexport default P;\n"
        body=old
    if old: body=old+"".join(f"export const {n} = P;\n" for n in sorted(exports) if f"export const {n} " not in old and f"export const {n}=" not in old and f" {n} = " not in old)
    open(path,"w").write(body)
    return f'import {names} from "./{f}"'
s=re.sub(r'import ((?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|[\w$]+|\* as [\w$]+)) from "([^"]+)"', fix, s)
open(p,"w").write(s)
# Runtime require("x") of bare modules -> namespace imports of the stand-ins.
s=open(p).read()
mods=sorted(set(re.findall(r'__require\("([^"./][^"]*)"\)', s)))
head=""
for mod in mods:
    safe=re.sub(r'[^a-z0-9]','_',mod.lower())
    f=f"auto_{safe}.mjs"; path=os.path.join(d,f)
    if not os.path.exists(path):
        base = P + (open(os.path.join(d,"stub-rn.mjs")).read() if mod=="react-native" else "") + "\nexport default P;\n"
        open(path,"w").write(base)
    head+=f'import * as __ns_{safe} from "./{f}";\n'
    s=s.replace(f'__require("{mod}")', f'__ns_{safe}')
open(p,"w").write(head+s)
