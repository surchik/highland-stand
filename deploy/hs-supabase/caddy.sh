#!/usr/bin/env bash
# Gives Highland Stand's own Supabase its public name: adds ONE block for hs-db.avunjian.com to
# /etc/caddy/Caddyfile, sending it to the gateway on 127.0.0.1:8200. No other line of the Caddyfile is changed.
#
#   ./caddy.sh            adds the block of caddy-block.txt, only if hs-db.avunjian.com is not in the Caddyfile yet
#   ./caddy.sh --narrow   adds, or puts in place of the block this script added, the block of caddy-block-narrow.txt
#   ./caddy.sh --plain    puts the block of caddy-block.txt in place of the block this script added
#   ./caddy.sh --remove   takes the block this script added out again (the rollback)
#   option: --skip-dns-check   do not ask that the name already points at this server
#
# Every change: a copy of the Caddyfile first (/etc/caddy/Caddyfile.bak-hs-<time>), then "caddy validate", then
# "systemctl reload caddy". If the validation or the reload fails, the copy is put back and Caddy is left running
# on what it had. It uses sudo (you will be asked for your password): the Caddyfile belongs to root.
#
# It only ever touches the lines between its own two marks. A block for the name that it did not add is left alone.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

CADDYFILE="${HS_CADDYFILE:-/etc/caddy/Caddyfile}"
PUBLIC_IP="${HS_PUBLIC_IP:-31.220.31.85}"
BEGIN_MARK="# >>> highland-supabase"
END_MARK="# <<< highland-supabase"
SUDO="${HS_SUDO-sudo}"   # (tests set it empty)

mode=add; block="$HERE/caddy-block.txt"; explicit=0; skip_dns=0
for a in "$@"; do
  case "$a" in
    --narrow) block="$HERE/caddy-block-narrow.txt"; explicit=1;;
    --plain) block="$HERE/caddy-block.txt"; explicit=1;;
    --remove) mode=remove;;
    --skip-dns-check) skip_dns=1;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) die "unknown option $a (see --help)";;
  esac
done

guard_home
need caddy systemctl curl awk grep cmp
[ -z "$SUDO" ] || need sudo
[ -f "$block" ] || die "no $block"
[ "$(grep -c "^$BEGIN_MARK" "$block")" = 1 ] && [ "$(grep -c "^$END_MARK" "$block")" = 1 ] || die "$block has lost its two marks"
grep -q "^$HS_PUBLIC_HOST {\$" "$block" || die "$block is not a block for $HS_PUBLIC_HOST"

work="$(mktemp -d)"
bak=""; changed=0
restore() {
  if [ "$changed" = 1 ] && [ -n "$bak" ]; then
    warn "putting the Caddyfile back from $bak"
    $SUDO cp -p "$bak" "$CADDYFILE" && changed=0
  fi
}
cleanup() { restore; rm -rf "$work"; }
trap cleanup EXIT

[ -z "$SUDO" ] || $SUDO -v || die "sudo is needed to read and change $CADDYFILE"
$SUDO cat "$CADDYFILE" > "$work/cur" || die "cannot read $CADDYFILE"

nb="$(grep -c "^$BEGIN_MARK" "$work/cur" || true)"; ne="$(grep -c "^$END_MARK" "$work/cur" || true)"
host="$(grep -c "$HS_PUBLIC_HOST" "$work/cur" || true)"
ours=0
if [ "$nb" != 0 ] || [ "$ne" != 0 ]; then
  lb="$(grep -n "^$BEGIN_MARK" "$work/cur" | head -1 | cut -d: -f1)"; le="$(grep -n "^$END_MARK" "$work/cur" | head -1 | cut -d: -f1)"
  [ "$nb" = 1 ] && [ "$ne" = 1 ] && [ "$lb" -lt "$le" ] || die "the marks of this script's block in $CADDYFILE are damaged (begin: $nb, end: $ne). Not touched: look at it by hand."
  ours=1
  sed -n "${lb},${le}p" "$work/cur" > "$work/ours"
fi

# ---- decide what to do ----------------------------------------------------------------------------------------
if [ "$mode" = remove ]; then
  [ "$ours" = 1 ] || { say "There is no block of this script's in $CADDYFILE. Nothing to remove."; exit 0; }
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" 'index($0, b) == 1 { skip = 1; next } skip && index($0, e) == 1 { skip = 0; next } !skip { print }' "$work/cur" > "$work/new"
  what="removed the block for $HS_PUBLIC_HOST"
elif [ "$ours" = 1 ]; then
  if cmp -s "$work/ours" "$block"; then say "The block for $HS_PUBLIC_HOST is already in $CADDYFILE, as $(basename "$block") has it. Nothing to change."; exit 0; fi
  if [ "$explicit" = 0 ]; then
    say "A block for $HS_PUBLIC_HOST is already in $CADDYFILE (it differs from caddy-block.txt). Nothing was changed."
    say "To put another in its place, say which: ./caddy.sh --plain   or   ./caddy.sh --narrow"
    exit 0
  fi
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v blk="$block" '
    index($0, b) == 1 { while ((getline line < blk) > 0) print line; skip = 1; next }
    skip && index($0, e) == 1 { skip = 0; next }
    !skip { print }' "$work/cur" > "$work/new"
  what="put $(basename "$block") in place of the block for $HS_PUBLIC_HOST"
elif [ "$host" != 0 ]; then
  say "$HS_PUBLIC_HOST is already named in $CADDYFILE, in lines this script did not add. Nothing was changed:"
  grep -n "$HS_PUBLIC_HOST" "$work/cur" | cut -c1-120
  exit 0
else
  cp "$work/cur" "$work/new"
  # one empty line between what is there and the new block
  [ -z "$(tail -c1 "$work/new")" ] || printf '\n' >> "$work/new"
  { printf '\n'; cat "$block"; } >> "$work/new"
  what="added the block of $(basename "$block") for $HS_PUBLIC_HOST"
fi

# the change touches nothing but this script's own lines: everything else must be the same, line for line
strip() { awk -v b="$BEGIN_MARK" -v e="$END_MARK" 'index($0, b) == 1 { skip = 1; next } skip && index($0, e) == 1 { skip = 0; next } !skip && NF { print }' "$1"; }
cmp -s <(strip "$work/cur") <(strip "$work/new") || die "the new Caddyfile would differ outside this script's block. Nothing was changed."

# ---- before changing anything -----------------------------------------------------------------------------------
if [ "$mode" != remove ]; then
  if [ "$skip_dns" = 0 ]; then
    ips="$(getent ahostsv4 "$HS_PUBLIC_HOST" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
    case " $ips" in
      *" $PUBLIC_IP "*) say "  $HS_PUBLIC_HOST points at $PUBLIC_IP";;
      *) die "$HS_PUBLIC_HOST does not point at $PUBLIC_IP yet (it gives: ${ips:-nothing}). Caddy could not get its certificate, and each failed try counts against Let's Encrypt's limits. Wait for the DNS record, then run this again. Nothing was changed.";;
    esac
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$HS_GW_PORT/auth/v1/settings" || true)"
  [ "$code" = 401 ] || warn "the gateway on 127.0.0.1:$HS_GW_PORT answers '$code', not 401: is the stack up (./status.sh)? Going on: the block only names the port."
fi
if ! $SUDO caddy validate --config "$CADDYFILE" --adapter caddyfile > "$work/validate0" 2>&1; then
  tail -5 "$work/validate0" >&2
  die "the Caddyfile as it is now does not pass 'caddy validate' when run by hand, so a validation after the change would say nothing. Nothing was changed."
fi

# ---- the change -------------------------------------------------------------------------------------------------
bak="$CADDYFILE.bak-hs-$(stamp)"
[ -z "$($SUDO ls "$bak" 2>/dev/null)" ] || bak="$bak-$$"     # never over an earlier copy
$SUDO cp -p "$CADDYFILE" "$bak" || die "could not make the backup $bak. Nothing was changed."
$SUDO cmp -s "$CADDYFILE" "$bak" || die "the backup $bak is not the same as the Caddyfile. Nothing was changed."
say "  backup: $bak"
changed=1
# written through tee, so the file keeps its owner and mode
$SUDO tee "$CADDYFILE" < "$work/new" > /dev/null
if ! $SUDO caddy validate --config "$CADDYFILE" --adapter caddyfile > "$work/validate1" 2>&1; then
  tail -8 "$work/validate1" >&2
  restore
  die "'caddy validate' refused the new Caddyfile. The backup is back in place; Caddy was not reloaded and runs as before."
fi
say "  caddy validate: the new Caddyfile is valid"
if ! $SUDO systemctl reload caddy; then
  restore
  $SUDO systemctl reload caddy || warn "the reload with the old Caddyfile also failed: look at  systemctl status caddy"
  die "Caddy refused to reload with the new Caddyfile. The backup is back in place."
fi
changed=0
state="$(systemctl is-active caddy || true)"
say "  $what; Caddy reloaded (it is $state)"
[ "$state" = active ] || warn "Caddy is not active: look at  systemctl status caddy  (the backup is $bak)"

if [ "$mode" != remove ]; then
  say "  waiting for Caddy to get the certificate and answer on https://$HS_PUBLIC_HOST (up to a minute)"
  code=""
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HS_PUBLIC_URL/auth/v1/settings" || true)"
    [ "$code" = 401 ] && break
    sleep 5
  done
  if [ "$code" = 401 ]; then say "  https://$HS_PUBLIC_HOST/auth/v1/settings answers 401 without a key: the name works, with a valid certificate"
  else warn "https://$HS_PUBLIC_HOST/auth/v1/settings answers '$code' (401 is expected). The certificate may still be on its way: journalctl -u caddy -n 30"; fi
fi
if [ "$mode" = remove ]; then say "To undo by hand: sudo cp -p $bak $CADDYFILE && sudo systemctl reload caddy"
else say "To undo: ./caddy.sh --remove   (or by hand: sudo cp -p $bak $CADDYFILE && sudo systemctl reload caddy)"; fi
