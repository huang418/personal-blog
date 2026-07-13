import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HUD')
export default class HUD extends Component {
  @property(Label)
  scoreLabel: Label | null = null;
  @property(Label)
  timerLabel: Label | null = null;
  @property(Node)
  hintNode: Node | null = null;

  private score = 0;
  private time = 0;

  onLoad() {
    this.node.on('score:changed', (s: number) => {
      this.score = s;
      if (this.scoreLabel) this.scoreLabel.string = `分数: ${this.score}`;
    }, this);
  }

  update(dt: number) {
    this.time += dt;
    if (this.timerLabel) this.timerLabel.string = `时间: ${Math.floor(this.time)}s`;
  }
}
