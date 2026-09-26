#!/usr/bin/env bash
# Regenerates the launcher icons and splash from the SVG sources in assets/branding (needs rsvg-convert).
set -euo pipefail
cd "$(dirname "$0")/.."
render() { rsvg-convert -w "$2" -h "$2" "assets/branding/$1.svg" -o "assets/images/$3.png"; }
render icon 1024 icon
render foreground 1024 android-icon-foreground
render background 1024 android-icon-background
render monochrome 1024 android-icon-monochrome
render splash 512 splash-icon
render splash 48 favicon
