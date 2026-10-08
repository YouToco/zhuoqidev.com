#!/usr/bin/env bash
# Mermaid diagrams and social cards are laid out in headless Chrome at build time; the runner
# image ships Chrome but no CJK fonts, which would shift every Chinese label. This installs the
# same files and fontconfig rules as Ubuntu 26.04's fonts-noto-cjk (1:20240730+repack1, built
# from upstream tag Serif2.003; the four .ttc files are byte-identical), but fetched straight
# from GitHub: apt usually took 20 s here and now and then 3-13 minutes on the Ubuntu mirror.
set -euo pipefail

commit=9b0f1436e455d902de067a2501422e5dc71ad16b # notofonts/noto-cjk, tag Serif2.003
base_url="https://raw.githubusercontent.com/notofonts/noto-cjk/$commit"
font_dir=/usr/local/share/fonts/noto-cjk
conf_file=/etc/fonts/conf.d/70-noto-cjk.conf

fonts=(
  "Sans/OTC/NotoSansCJK-Regular.ttc b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a"
  "Sans/OTC/NotoSansCJK-Bold.ttc faa5f3656a78b2e2d450d27fe8382c778bc2b6bb5ea29c986664a6a435056ceb"
  "Serif/OTC/NotoSerifCJK-Regular.ttc 5d9c31a059600193c9d7968a998bde886ccdc77e934006ad243b41794c496a7d"
  "Serif/OTC/NotoSerifCJK-Bold.ttc 1505ee3b9c0890fae6302ee0e9c6fd74d690f4a55a6ace1d9944f3f6352d622d"
)

work=$(mktemp -d "${RUNNER_TEMP:-/tmp}/noto-cjk.XXXXXX")
trap 'rm -rf -- "$work"' EXIT

for entry in "${fonts[@]}"; do
  path=${entry% *}
  sha256=${entry#* }
  name=${path##*/}
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    --retry 3 --connect-timeout 10 \
    --output "$work/$name" "$base_url/$path"
  printf '%s  %s\n' "$sha256" "$work/$name" | sha256sum --check --strict
done

# Text tagged zh-CN that asks for a generic family must get the Simplified Chinese faces, not
# whichever of the five regional faces fontconfig happens to rank first (usually Japanese).
# Same rules as the package's 70-fonts-noto-cjk.conf: prepend the regional face for each
# language, and bind it strongly for Chinese.
rule() { # rule <lang> <generic family> <face> [binding]
  printf '  <match target="pattern">\n'
  printf '    <test name="lang"><string>%s</string></test>\n' "$1"
  printf '    <test name="family"><string>%s</string></test>\n' "$2"
  printf '    <edit name="family" mode="prepend"%s><string>%s</string></edit>\n' "${4:+ binding=\"$4\"}" "$3"
  printf '  </match>\n'
}
{
  printf '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n'
  for generic in serif sans-serif monospace; do
    case $generic in
      serif) face="Noto Serif CJK" ;;
      sans-serif) face="Noto Sans CJK" ;;
      monospace) face="Noto Sans Mono CJK" ;;
    esac
    rule ja "$generic" "$face JP"
    rule ko "$generic" "$face KR"
    rule zh-cn "$generic" "$face SC" strong
    rule zh-tw "$generic" "$face TC" strong
    rule zh-hk "$generic" "$face HK" strong
  done
  printf '</fontconfig>\n'
} >"$work/70-noto-cjk.conf"

sudo install -d -m 755 "$font_dir"
sudo install -m 644 "$work"/*.ttc "$font_dir/"
sudo install -m 644 "$work/70-noto-cjk.conf" "$conf_file"
sudo fc-cache -f "$font_dir"

# A bare "-" in a fontconfig pattern starts the point size ("sans-serif" would ask for family
# "sans"), hence the escape.
for check in 'sans\-serif:lang=zh-cn=Noto Sans CJK SC' 'serif:lang=zh-cn=Noto Serif CJK SC'; do
  pattern=${check%=*}
  expected=${check##*=}
  actual=$(fc-match --format '%{family[0]}' "$pattern")
  if [[ $actual != "$expected" ]]; then
    echo "fontconfig resolves $pattern to $actual, expected $expected" >&2
    exit 1
  fi
done
