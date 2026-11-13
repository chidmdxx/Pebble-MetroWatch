# Metro Calendar

Metro Calendar targets only the newer, larger-screen Pebble Time 2 (`emery`, 200x228) and Pebble Round 2 (`gabbro`, 260x260). It uses a vertical Metro-inspired layout so the clock, upcoming events, and optional weather stay within the Round 2 display's safe area. The time uses Microsoft's Selawik font. No legacy-platform binaries are included.

## Features

- Large Selawik digital clock and current date. The clock follows the watch's 12/24-hour preference and uses a taller font in 24-hour mode when space permits.
- Up to three upcoming or in-progress events, ordered by start time, with time on the left and title on the right. Long titles are shortened to fit. Events on another day show the weekday alongside their time.
- Direct subscription to Pebble's built-in `calendar/event` source; no `preferences/complications` lookup or mode-based preference ordering.
- Optional all-day events. **Skip all-day events** defaults on; when disabled, an explicitly all-day event is labeled `ALL DAY` and never shows a start time. Events with missing or malformed all-day data are ignored.
- Optional current weather from Pebble's selected provider, shown as a centered condition icon and temperature. **Show current weather (plugin)** defaults off; when enabled, the face subscribes to `weather/location` and displays only valid provider data.
- A dark-by-default light mode toggle, plus 20 selectable Windows Phone-inspired accents and a settings swatch.
- No custom network requests, weather API, or location tracking.

Calendar and location permissions are optional so the face still installs and shows the clock if access is declined. Enable calendar access in the Pebble app to see events. The built-in calendar and weather plugin sources require Pebble mobile app 1.16 or later and the Plugins preview enabled under **Settings → Plugins → Plugins / permissions preview**. This is a mobile-app preview capability, not a watch-specific hardware feature. Weather is not subscribed to unless its setting is enabled.

## Build and test

Use Pebble SDK 4.44 or later and `pebble-tool` 5.1.0 or later for the plugin-source API and permission manifest. The watchface builds only for Emery and Gabbro; Gabbro is the primary layout target.

```powershell
pebble build
pebble install --emulator gabbro
pebble screenshot --no-open --emulator gabbro screenshot_gabbro.png
```

Run the phone-side calendar tests with `node --test tests/calendar.test.js` (Node.js 18 or later).

The generated watchface package is written under `build/`. Settings use Clay and are available offline in the Pebble mobile app. No Store publication or release notes are included.

The Pebble App Store requires unframed screenshots at each target's native resolution: 260x260 for Gabbro and 200x228 for Emery. The official submission guide lists 80x80 and 144x144 icons for watchapps only; watchfaces do not use listing icons. Any icon artwork delivered with this project is supplemental branding, not a watchface submission field.

Platform details: [Hardware Information](https://developer.repebble.com/guides/tools-and-resources/hardware-information/), [Alloy development](https://developer.repebble.com/guides/alloy/), [Plugins Preview](https://developer.repebble.com/guides/plugins/preview/), and [Preparing an App Store Submission](https://developer.repebble.com/guides/appstore-publishing/preparing-a-submission/).

## Palette and font

Light mode and accents are separate settings. **Theme default** uses cyan `#1EA1E0` in either mode. The 20 selectable hex values come from the archived [Windows Phone 8 colors list](https://github.com/StudioCreate/metro-ui-colors/blob/master/Windows-Phone-8-official-colors.txt); names are informal descriptions informed by a [community palette](https://superdevresources.com/windows-phone-theme-colors/), not official names. Pebble displays may approximate these RGB values. Microsoft's archived [Windows Phone theme resources](https://learn.microsoft.com/en-us/previous-versions/windows/apps/ff769552(v=vs.105)) define accent and background separately. The AM/PM and weekday labels use the selected accent; some accents may be hard to read against a particular theme. Weather icon details fall back to the theme foreground when the accent is too close to the background.

Selawik is Microsoft's open-source Segoe UI replacement and is licensed under the SIL Open Font License 1.1. The original regular-weight font is subset to Basic Latin for the watch; its license is included at [`src/embeddedjs/assets/Selawik-LICENSE.txt`](src/embeddedjs/assets/Selawik-LICENSE.txt). See [Microsoft's Selawik typography page](https://learn.microsoft.com/en-us/typography/font-list/selawik).

## Pebble development reference

This project follows the maintained [Pebble Watchface & Watchapp Agent Skill](https://github.com/coredevices/pebble-watchface-agent-skill/blob/main/skills/pebble-watchface/SKILL.md), with Gabbro selected as the primary target.
