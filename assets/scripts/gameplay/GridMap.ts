import { _decorator, Component, Node, Vec3 } from 'cc';
import { Cell } from './MazeGenerator';
const { ccclass, property } = _decorator;

@ccclass('GridMap')
export default class GridMap extends Component {
  @property
  cols = 11;
  @property
  rows = 9;
  @property
  cellSize = 64; // 像素

  grid: Cell[][] | null = null;

  // 设置生成后的格子数据
  public setGrid(grid: Cell[][]) {
    this.grid = grid;
    this.cols = grid[0].length;
    this.rows = grid.length;
  }

  // 将格子坐标 -> 世界位置（2D UI 坐标系中）
  public cellToWorld(cx: number, cy: number): Vec3 {
    const width = this.cols * this.cellSize;
    const height = this.rows * this.cellSize;
    const startX = -width / 2 + this.cellSize / 2;
    const startY = height / 2 - this.cellSize / 2;
    const wx = startX + cx * this.cellSize;
    const wy = startY - cy * this.cellSize;
    return new Vec3(wx, wy, 0);
  }

  // 判断从 (x,y) 是否可向 dir 移动（0:up,1:right,2:down,3:left）
  public canMove(x: number, y: number, dir: number): boolean {
    if (!this.grid) return false;
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
    const cell = this.grid[y][x];
    if (cell.walls[dir]) return false;
    // 检查边界目标是否在地图内
    const tx = x + (dir === 1 ? 1 : dir === 3 ? -1 : 0);
    const ty = y + (dir === 0 ? -1 : dir === 2 ? 1 : 0);
    return tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows;
  }
}
