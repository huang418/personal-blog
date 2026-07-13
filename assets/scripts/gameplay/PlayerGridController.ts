import { _decorator, Component, Node, Vec2, tween, Vec3 } from 'cc';
import { InputEvents } from '../input/SwipeInput';
import { FlipEvents, FlipState } from '../core/FlipManager';
import { mapInputToWorld, vecToDir4, Dir4 } from '../core/InputMapper';
import GridMap from './GridMap';
const { ccclass, property } = _decorator;

@ccclass('PlayerGridController')
export default class PlayerGridController extends Component {
  @property
  speed = 6.0; // tween 时间（秒）

  @property(GridMap)
  map: GridMap | null = null;

  gridX = 0;
  gridY = 0;
  currentFlip: FlipState = FlipState.Identity;
  private _moving = false;

  onLoad() {
    InputEvents.on('input:swipe', this.onSwipe, this);
    FlipEvents.on('flip:changed', this.onFlipChanged, this);
    // 初始位置由外部设置，或默认 0,0
  }

  onDestroy() {
    InputEvents.off('input:swipe', this.onSwipe);
    FlipEvents.off('flip:changed', this.onFlipChanged);
  }

  onFlipChanged(state: FlipState) {
    this.currentFlip = state;
  }

  // 外部用于设置起始格子并把节点移动到对应位置
  public setGridPos(x: number, y: number) {
    this.gridX = x; this.gridY = y;
    if (this.map) {
      const pos = this.map.cellToWorld(x, y);
      this.node.setPosition(pos);
    }
  }

  private onSwipe(dirVec: Vec2) {
    if (this._moving || !this.map) return;
    const worldDir = mapInputToWorld(dirVec, this.currentFlip);
    const d = vecToDir4(worldDir);
    if (d === null) return;
    const dx = d === Dir4.Right ? 1 : d === Dir4.Left ? -1 : 0;
    const dy = d === Dir4.Down ? 1 : d === Dir4.Up ? -1 : 0;
    // mapping to dir index (0 up,1 right,2 down,3 left)
    const dirIdx = d;
    if (this.map.canMove(this.gridX, this.gridY, dirIdx)) {
      this.moveTo(this.gridX + dx, this.gridY + dy);
    } else {
      // 不能移动时可做反馈（抖动）
      this.bump();
    }
  }

  private moveTo(nx: number, ny: number) {
    if (!this.map) return;
    this._moving = true;
    const target = this.map.cellToWorld(nx, ny);
    tween(this.node)
      .to(this.speed / 60, { position: target }, { easing: 'quartOut' })
      .call(() => {
        this.gridX = nx; this.gridY = ny;
        this._moving = false;
        // 通知收集物检测
        this.node.emit('player:moved', { x: nx, y: ny });
      })
      .start();
  }

  private bump() {
    // 简单小位移反馈
    const orig = this.node.position.clone();
    tween(this.node)
      .by(0.06, { position: new Vec3(0, -8, 0) })
      .by(0.06, { position: new Vec3(0, 8, 0) })
      .call(() => this.node.setPosition(orig))
      .start();
  }
}
