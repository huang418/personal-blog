// 递归回溯生成迷宫（格子）并暴露墙数据
import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

export type Cell = {
  x: number;
  y: number;
  walls: [boolean, boolean, boolean, boolean]; // 上 右 下 左 是否有墙
  visited?: boolean;
};

@ccclass('MazeGenerator')
export default class MazeGenerator extends Component {
  // 生成一个 cols x rows 的迷宫数据（返回二维数组）
  public generate(cols: number, rows: number): Cell[][] {
    // init
    const grid: Cell[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < cols; x++) {
        row.push({ x, y, walls: [true, true, true, true], visited: false });
      }
      grid.push(row);
    }

    const stack: Cell[] = [];
    const start = grid[0][0];
    start.visited = true;
    stack.push(start);

    const neighbors = (c: Cell) => {
      const list: { cell: Cell; dir: number }[] = [];
      const { x, y } = c;
      if (y > 0 && !grid[y - 1][x].visited) list.push({ cell: grid[y - 1][x], dir: 0 }); // up
      if (x < cols - 1 && !grid[y][x + 1].visited) list.push({ cell: grid[y][x + 1], dir: 1 }); // right
      if (y < rows - 1 && !grid[y + 1][x].visited) list.push({ cell: grid[y + 1][x], dir: 2 }); // down
      if (x > 0 && !grid[y][x - 1].visited) list.push({ cell: grid[y][x - 1], dir: 3 }); // left
      return list;
    };

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const nbs = neighbors(current);
      if (nbs.length === 0) {
        stack.pop();
      } else {
        const idx = Math.floor(Math.random() * nbs.length);
        const chosen = nbs[idx];
        const nx = chosen.cell.x, ny = chosen.cell.y;
        // remove wall between current and chosen
        current.walls[chosen.dir] = false;
        const opp = (d: number) => (d + 2) % 4;
        chosen.cell.walls[opp(chosen.dir)] = false;
        chosen.cell.visited = true;
        stack.push(chosen.cell);
      }
    }

    // clear visited flags
    for (let r of grid) for (let c of r) c.visited = false;

    return grid;
  }
}
