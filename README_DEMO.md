# Mirror Maze - Demo README

This folder contains the Mirror Maze demo project setup for Cocos Creator v3.8.7.

What is included in this branch (mirror-maze-starter):
- Core scripts: MazeGenerator, GridMap, PlayerGridController, CollectibleGrid, FlipManager, InputMapper
- UI scripts: FlipHintUI, MapAutoFit
- Sample scenes: Main.scene (configured for portrait 720x1280)
- Docs: docs/DESIGN.md, docs/DESIGN_en.md
- Settings: assets/settings/levels.json (10 sample levels)

Quick start (open & run in Cocos Creator)
1. Install Cocos Creator v3.8.7.
2. Clone the repo and switch to the demo branch:
   git clone <repo-url>
   cd personal-blog
   git fetch origin
   git checkout mirror-maze-starter
   git pull origin mirror-maze-starter

3. Open the project in Cocos Creator and wait for scripts to compile.
4. Open `scenes/Main.scene`.
5. In the Canvas inspector, ensure Design Resolution is `720 x 1280` (portrait).
6. In Hierarchy, select GameRoot -> GameManager and ensure all fields are correctly assigned (MazeGenerator, GridMap, WallRoot, WallPrefab, CollectibleRoot, CollectiblePrefab, Player, FlipManager). Replace any missing prefabs.
7. Run Preview (Ctrl/Cmd+P) and test:
   - Swipe to move one tile per swipe
   - Watch for FlipHintUI warning and flip changes
   - Collectibles appear/disappear according to flip state and emit 'collected'

If the scene shows missing assets or errors, see Troubleshooting below.

Troubleshooting
- "The native asset <uuid> is missing" — check that both the image and its .meta file are present in `assets/` and reimport the asset in Editor.
- "Rect width exceeds maximum margin" — open the sprite and set Type = SIMPLE or adjust 9-slice Border values.
- "instantiate is nil" — GameManager prefab fields are empty. Assign proper prefabs in Inspector.

How to create a ZIP of the demo
- On a machine with Git and zip installed you can run the included script (project root):

  bash build-scripts/pack_demo.sh

- This will create `mirror-maze-demo.zip` containing the project files needed for import to Cocos Creator.

Notes
- Some binary asset references (.meta) are required. Do not remove .meta files when copying to another machine.
- For TTRecord (recording) and platform-specific builds (Douyin), configure appId & certificates in the platform build settings and test on device.
