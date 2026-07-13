import { _decorator, Component, input, Input, Touch, Vec2, EventTarget } from 'cc';
const { ccclass, property } = _decorator;

export const InputEvents = new EventTarget();

@ccclass('SwipeInput')
export default class SwipeInput extends Component {
  private _startPos: Vec2 | null = null;
  @property({ tooltip: '滑动触发的最小位移（像素）' })
  minDistance = 20;

  onLoad() {
    input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
    input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this._onTouchStart);
    input.off(Input.EventType.TOUCH_END, this._onTouchEnd);
  }

  private _onTouchStart(touch: Touch) {
    this._startPos = touch.getLocation();
  }

  private _onTouchEnd(touch: Touch) {
    if (!this._startPos) return;
    const end = touch.getLocation();
    const delta = end.subtract(this._startPos);
    if (delta.length() < this.minDistance) {
      this._startPos = null;
      return;
    }
    const dir = new Vec2(delta.x, delta.y).normalize();
    InputEvents.emit('input:swipe', dir);
    this._startPos = null;
  }
}
