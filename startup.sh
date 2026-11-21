#!/bin/bash
# Launch the weather display in kiosk mode on the Raspberry Pi.
# Override the URL for a local Docker install: WEATHERTRACKER_URL=http://localhost:8080/ ./startup.sh
export DISPLAY=:0

URL="${WEATHERTRACKER_URL:-https://weather.kajgm.com/}"

# Raspberry Pi OS Bookworm ships `chromium`; older releases ship `chromium-browser`.
BROWSER="$(command -v chromium || command -v chromium-browser)"

nohup "$BROWSER" --kiosk --app="$URL" --start-fullscreen --incognito \
  --noerrdialogs --disable-infobars --check-for-update-interval=31536000 \
  >/dev/null 2>&1 &
