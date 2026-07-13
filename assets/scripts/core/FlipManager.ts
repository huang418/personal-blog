import { _decorator, Component, EventTarget } from 'cc';
const { ccclass, property } = _decorator;

export enum FlipState {
  Identity = 'Identity',
  MirrorX = 'MirrorX',
  MirrorY = 'MirrorY',
  DiagPos = 'DiagPos',
  DiagNeg = 'DiagNeg'
}

export const FlipEvents = new EventTarget();

@ccclass('FlipManager')
export default class FlipManager extends Component {
  @property({ tooltip: '秒' })
  flipInterval = 5.0;
  @property({ tooltip: '翻转前提示时长（秒）' })
  warningTime = 0.5;

  current: FlipState = FlipState.Identity;
  private _timer = 0;
  private _nextFlipIn = 0;

  onLoad() {
    this.resetTimer();
    FlipEvents.emit('flip:changed', this.current);
  }

  resetTimer() {
    this._timer = 0;
    this._nextFlipIn = this.flipInterval;
  }

  update(dt: number) {
    this._timer += dt;
    const remain = this._nextFlipIn - this._timer;
    if (remain <= this.warningTime && remain + dt > this.warningTime - 1e-6) {
      FlipEvents.emit('flip:warning', this.warningTime);
    }
    FlipEvents.emit('flip:tick', Math.max(0, this._nextFlipIn - this._timer));
    if (this._timer >= this._nextFlipIn) {
      this._doFlip();
      this._timer = 0;
      this._nextFlipIn = this.flipInterval;
    }
  }

  private _doFlip() {
    const states = Object.values(FlipState).filter(s => s !== this.current);
    const idx = Math.floor(Math.random() * states.length);
    this.current = states[idx] as FlipState;
    FlipEvents.emit('flip:changed', this.current);
  }
}
