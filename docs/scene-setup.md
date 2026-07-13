场景搭建（Main 场景最小步骤）
1. 新建场景 Main.scene，根节点命名 GameRoot。
2. 在 GameRoot 下创建子节点并挂组件：
   - MazeGenerator（assets/scripts/gameplay/MazeGenerator.ts）
   - GridMap（GridMap.ts）：设置 cols/rows/cellSize（与 MazeGenerator 一致）。
   - FlipManager（core/FlipManager.ts）：设置 flipInterval/warningTime。
   - GameManager（core/GameManager.ts）：将 mazeGen, gridMap, flipManager 指向对应组件；创建 wallRoot、collectibleRoot、并拖入 wallPrefab、collectiblePrefab（你需要在编辑器里创建这两个 Prefab：简单的 Sprite 节点即可）。
3. 创建 Player 节点（Sprite），添加 PlayerGridController 组件并把 map 指向 GridMap。
4. 创建 UI Canvas，挂 HUD（scoreLabel/timerLabel），并挂 FlipHintUI（scripts/ui/FlipHintUI.ts），把 hintLabel/iconNode 指向 UI 元素。
5. 在场景任意节点挂 SwipeInput 脚本（assets/scripts/input/SwipeInput.ts）。
6. 把 Player 节点放在 GameRoot 作为同级节点，确保其父节点是可接收 'player:moved' 事件（GameRoot 足够）。
7. 创建 wallPrefab：一个 Sprite（或九宫格）代表墙块；设置合适大小（例如 cellSize x 6 像素 或 6 x cellSize 旋转）。
8. 创建 collectiblePrefab：Sprite 节点，挂上 CollectibleGrid 脚本（设置 allowedStates 可空留默认）。可加简单收集动画。

如何测试
- 在 Creator 中打开场景，运行预览。
- 用触摸/鼠标拖动做一次滑动：玩家应当向对应“显示方向”移动一格（比如画面左右翻转时，左滑会使玩家往相反格子移动，因为 InputMapper 做了转换）。
- 等待 FlipManager 的翻转周期，观察 UI 的“镜像即将切换”提示（0.5s）以及翻转后收集物的显隐变化。
- 收集物被收集时 score 增加，HUD 显示分数。
