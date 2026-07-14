import { _decorator, Component, Node, CCString } from 'cc';
import { FlipState, FlipEvents } from '../core/FlipManager';
const { ccclass, property } = _decorator;

@ccclass('CollectibleGrid')
export default class CollectibleGrid extends Component {
  @property
  gridX = 0;
  @property
  gridY = 0;
  @property([CCString])
  allowedStates: string[] = [FlipState.Identity];

  private _collected = false;

  onLoad() {
    FlipEvents.on('flip:changed', this.onFlipChanged, this);
    // 监听玩家移动事件（PlayerGridController 在移动完成后会 emit）
    this.node.parent?.on('player:moved', this.onPlayerMoved, this);
  }

  onDestroy() {
    FlipEvents.off('flip:changed', this.onFlipChanged);
    this.node.parent?.off('player:moved', this.onPlayerMoved, this);
  }

  onFlipChanged(state: FlipState) {
    const ok = this.allowedStates.includes(state);
    this.node.active = ok && !this._collected;
  }

  onPlayerMoved(detail: any) {
    if (this._collected) return;
    if (detail.x === this.gridX && detail.y === this.gridY && this.node.active) {
      this._collected = true;
      this.node.active = false;
      // 通知得分
      this.node.emit('collected', { x: this.gridX, y: this.gridY });
    }
  }
}
