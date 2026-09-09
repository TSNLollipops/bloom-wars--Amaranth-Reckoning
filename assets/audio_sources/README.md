# assets/audio_sources/

Raw, unedited CC0 (public domain) audio source packs, kept here so the
project doesn't depend on Kenney.nl or OpenGameArt.org staying online or
keeping these exact files at these exact URLs. `public/audio/CREDITS.txt`
is still the record of which shipped file came from which source file and
what was done to it (trim, fade, resample) — this folder is what makes
"swap it for something else from the same pack" possible without
re-downloading anything.

## kenney_sci-fi-sounds/

The full Kenney "Sci-fi Sounds" pack (v1.0, 11 Oct 2020), 74 `.ogg` files
under `Audio/`, plus Kenney's own `License.txt` (CC0 — no attribution
required, credit appreciated). Source: https://kenney.nl/assets/sci-fi-sounds

Four of these are already in use, converted and trimmed, as
`public/audio/sfx_hit.ogg` (`impactMetal_002.ogg`), `sfx_dodge.ogg`
(`forceField_001.ogg`), `sfx_kill.ogg` (`explosionCrunch_003.ogg`), and
`sfx_pilot_lost.ogg` (`lowFrequency_explosion_001.ogg`) — see
`public/audio/CREDITS.txt` for the exact trim/fade applied to each. The
other 70 are here unused, for picking a different sting later without
needing this pack fetched again.

## opengameart_scifi_city_ambient/

`busy_cyberworld.ogg` — "Scifi City - Ambient Loop" by TinyWorlds, CC0.
Source: https://opengameart.org/content/scifi-city-ambient-loop

This is the unmodified source for `public/audio/hub_ambient.ogg` (same
29.3s loop, just resampled to 44100Hz stereo with a short fade-in/out at
the seam — no trim). OpenGameArt doesn't bundle a license file with the
download; the CC0 grant is stated on the page above, not restated here.

## kenney_interface-sounds/

The full Kenney "Interface Sounds" pack, 100 `.ogg` files under `Audio/`,
plus Kenney's own `License.txt` (CC0). Source:
https://kenney.nl/assets/interface-sounds

`click_001.ogg` is the source for `public/audio/sfx_click.ogg` (converted,
untrimmed). The other 99 are here unused.

## kenney_music-jingles/

The full Kenney "Music Jingles" pack, 85 `.ogg` files across five
subfolders under `Audio/` (`8-Bit jingles/`, `Hit jingles/`, `Pizzicato
jingles/`, `Sax jingles/`, `Steel jingles/`), plus Kenney's own
`License.txt` (CC0). Source: https://kenney.nl/assets/music-jingles

`Steel jingles/jingles_STEEL01.ogg` is the source for
`public/audio/sfx_mission_win.ogg` (converted, untrimmed). The other 84 are
here unused.

## opengameart_scifi_background_noise/

`scifi background noise.ogg` — "Sci-Fi Background noise" by Julie
Damsgaard / Spring Spring / Spring Enterprises, CC0. Source:
https://opengameart.org/content/sci-fi-background-noise

This is the unmodified source for `public/audio/battle_ambient.ogg` (same
~72s loop, just resampled to 44100Hz stereo with a short fade-in/out at the
seam — no trim, same treatment as hub_ambient above).

All seven shipped `public/audio/` files now have their raw source archived
here. Everything unused in each pack is kept too, in case a different
sting or jingle from the same pack is wanted later.

Added 9 Sep 2026, from Maxime's own saved copies in his Downloads folder.
