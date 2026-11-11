#!/usr/bin/env bash
# Zachowane dla zgodności: deleguje do scripts/ask-helper.sh (pomocnik: agy).
# Użycie: scripts/agy-ask.sh [opcje ask-helper] "prompt"
exec "$(dirname "$0")/ask-helper.sh" "${@:1:$(($#-1))}" agy "${@: -1}"
