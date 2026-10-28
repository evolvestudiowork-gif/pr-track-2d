#!/bin/bash
cd "$(dirname "$0")" || exit 1
/bin/bash scripts/install-macos.sh
result=$?
printf '\nNhan Enter de dong cua so...'
read -r _answer
exit "$result"
