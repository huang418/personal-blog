# Mirror Maze — Design Document (EN)

One-line summary
- Your controls are reversed, and the flip rules change over time.

Overview
- Top-down grid maze where the screen shows a mirrored/flipped version of controls.
- Players collect keys and reach the exit. The input mapping flips (left/right, up/down, diagonal, rotate) and changes dynamically during a run.

Flip rhythm example
- 0-15s: No flip (tutorial)
- 15-30s: Left-Right flip
- 30-45s: Up-Down flip
- 45-60s: Alternate every 10s
- 60s+: Diagonal + random rotate every 5s

Core systems
- Maze generation: recursive backtracker (random with difficulty)
- Flip implementation: input mapping flip (lightweight)
- Flip animation: circular mask + UI flash
- Tile-based collision via GridMap

Social & Distribution (Douyin/TikTok)
- First-run recording (slow-mo + funny sound)
- Daily maze codes and leaderboard challenges
- Ghost replays & asynchronous challenges

Visual
- Minimal geometry + neon glow
- Normal state: blue/purple; flip state: orange/red; dark background

Project structure and how to play
- See README_DEMO.md for detailed steps to open, run and test in Cocos Creator v3.8.7.
