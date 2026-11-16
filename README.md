# Last.fm Stats Plugin

A Vencord plugin that displays your Last.fm statistics directly in Discord.

## Features

- Profile summary: total scrobbles, artist / album / track counts, daily average
- Now playing / last played, refreshed every 30 seconds while the window is open
- Recent tracks, top tracks, top albums, top artists, loved tracks and friends
- Time range picker for the top lists (7 days up to all time), remembered between sessions
- Artwork for tracks and artists, which the Last.fm API no longer returns on its own

## Installation

Clone this repository into `src/userplugins/lastFmStats` of your Vencord checkout, then rebuild with `pnpm build`.

## Setup

1. **Get a Last.fm API Key**:
   - Go to [Last.fm API](https://www.last.fm/api/account/create)
   - Create an API account

2. **Configure the Plugin**:
   - Open Vencord Settings
   - Navigate to the LastFMStats plugin
   - Enter your Last.fm username and API key

3. **Access Your Stats**:
   - Click the red Last.fm button at the top of your server list
