import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import MazeGenerator from '../gameplay/MazeGenerator';
import GridMap from '../gameplay/GridMap';
import PlayerGridController from '../gameplay/PlayerGridController';
import CollectibleGrid from '../gameplay/CollectibleGrid';
import FlipManager from './FlipManager';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export default class GameManager extends Component {
  @property(MazeGenerator)
  mazeGen: MazeGenerator | null = null;
  @property(GridMap)
  gridMap: GridMap | null = null;
  @property(Node)
  wallRoot: Node | null = null;
  @property(Prefab)
  wallPrefab: Prefab | null = null;
  @property(Node)
  collectibleRoot: Node | null = null;
  @property(Prefab)
  collectiblePrefab: Prefab | null = null;
  @property(PlayerGridController)
  player: PlayerGridController | null = null;
  @property(FlipManager)
  flipManager: FlipManager | null = null;

  private score = 0;

  start() {
    this.setupLevel();
    if (this.flipManager) this.flipManager.resetTimer();
  }

  setupLevel() {
    if (!this.mazeGen || !this.gridMap) return;
    const grid = this.mazeGen.generate(this.gridMap.cols, this.gridMap.rows);
    this.gridMap.setGrid(grid);

    // 清理已有墙与收集物
    this.wallRoot?.removeAllChildren();
    this.collectibleRoot?.removeAllChildren();

    // 创建墙（以 cell walls 为准，每格画出右和下墙以避免重复）
    for (let y = 0; y < this.gridMap.rows; y++) {
      for (let x = 0; x < this.gridMap.cols; x++) {
        const cell = grid[y][x];
        const basePos = this.gridMap.cellToWorld(x, y);
        // 画右墙
        if (cell.walls[1]) {
          if (this.wallPrefab && this.wallRoot) {
            try {
              const w = instantiate(this.wallPrefab);
              w.setPosition(basePos.x + this.gridMap.cellSize / 2, basePos.y, 0);
              // 调整宽高或旋转以适合视觉
              this.wallRoot.addChild(w);
            } catch (e) {
              console.warn('GameManager: failed to instantiate wallPrefab', e);
            }
          } else {
            // 如果没有设置 prefab 或 root，记录但继续运行
            if (!this.wallPrefab) console.warn('GameManager: wallPrefab is not assigned; skipping wall creation');
            if (!this.wallRoot) console.warn('GameManager: wallRoot is not assigned; cannot attach walls');
          }
        }
        // 画下墙
        if (cell.walls[2]) {
          if (this.wallPrefab && this.wallRoot) {
            try {
              const w = instantiate(this.wallPrefab);
              w.setPosition(basePos.x, basePos.y - this.gridMap.cellSize / 2, 0);
              w.setRotationFromEuler(0, 0, 90);
              this.wallRoot.addChild(w);
            } catch (e) {
              console.warn('GameManager: failed to instantiate wallPrefab (rotated)', e);
            }
          } else {
            if (!this.wallPrefab) console.warn('GameManager: wallPrefab is not assigned; skipping wall creation');
            if (!this.wallRoot) console.warn('GameManager: wallRoot is not assigned; cannot attach walls');
          }
        }
      }
    }

    // 生成若干收集物（示例：随机放置 8 个）
    const total = Math.min(8, this.gridMap.cols * this.gridMap.rows - 1);
    let placed = 0;
    const placedPositions = new Set<string>();
    while (placed < total) {
      const rx = Math.floor(Math.random() * this.gridMap.cols);
      const ry = Math.floor(Math.random() * this.gridMap.rows);
      // 避免起点 (0,0)
      if (rx === 0 && ry === 0) continue;
      const key = `${rx},${ry}`;
      if (placedPositions.has(key)) continue;

      if (!this.collectiblePrefab) {
        if (placed === 0) console.warn('GameManager: collectiblePrefab is not assigned; skipping collectible creation');
        break; // 没有 prefab 就没法继续放置
      }
      if (!this.collectibleRoot) {
        console.warn('GameManager: collectibleRoot is not assigned; cannot attach collectibles');
        break;
      }

      try {
        const prefab = instantiate(this.collectiblePrefab);
        prefab.setPosition(this.gridMap.cellToWorld(rx, ry));
        const comp = prefab.getComponent(CollectibleGrid);
        if (comp) {
          comp.gridX = rx; comp.gridY = ry;
          // 随机设置可见状态
          comp.allowedStates = [Math.random() > 0.5 ? 'MirrorX' : 'Identity'];
        }
        this.collectibleRoot.addChild(prefab);
        // 监听 collect 事件
        prefab.on('collected', () => {
          this.onCollected();
        }, this);
      } catch (e) {
        console.warn('GameManager: failed to instantiate collectiblePrefab', e);
      }

      placedPositions.add(key);
      placed++;
    }

    // place player at 0,0
    if (this.player) this.player.setGridPos(0, 0);
  }

  onCollected() {
    this.score += 1;
    this.node.emit('score:changed', this.score);
    // 检查胜利条件（示例：收集全部）
    // 简化：当 score 达到 8 触发胜利
    // TODO: 更合理统计 target
  }
}
