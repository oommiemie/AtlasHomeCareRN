#!/bin/sh
# Bundles the assistant for Node, with stand-ins for the phone-only modules.
set -e
D="$(cd "$(dirname "$0")" && pwd)"
O="$D/.out"
mkdir -p "$O"
cp "$D"/stub-*.mjs "$D/xhr.mjs" "$D/eval.mjs" "$D/eval2.mjs" "$D/eval3.mjs" "$D/autostub.py" "$O/"
rm -f "$O"/auto_*.mjs
cd "$D/../.."
npx esbuild "$D/entry.ts" --bundle --platform=node --format=esm --outfile="$O/all.mjs" --log-level=error \
  '--external:react-native' '--external:expo-*' '--external:@react-native-*' '--external:react' \
  '--external:@react-navigation/*' '--external:react-native-*' '--external:lucide-react-native'
sed -i '' -e 's#from "expo-file-system"#from "./stub-fs.mjs"#; s#from "expo-localization"#from "./stub-loc.mjs"#; s#from "react"#from "./stub-react.mjs"#' "$O/all.mjs"
python3 "$O/autostub.py" "$O"
