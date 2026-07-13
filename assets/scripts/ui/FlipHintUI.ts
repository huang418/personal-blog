import { _decorator, Component, Label, Node } from 'cc';
import { FlipEvents, FlipState } from '../core/FlipManager';
const { ccclass, property } = _decorator;

@ccclass('FlipHintUI')
export default class FlipHintUI extends Component {
  @property(Label)
  hintLabel: Label | null = null;
  @property(Node)
  iconNode: Node | null = null;

  onLoad() {
    FlipEvents.on('flip:warning', this.onWarning, this);
    FlipEvents.on('flip:changed', this.onChanged, this);
  }

  onDestroy() {
    FlipEvents.off('flip:warning', this.onWarning);
    FlipEvents.off('flip:changed', this.onChanged);
  }

  onWarning(timeLeft: number) {
    if (this.hintLabel) this.hintLabel.string = `镜像即将切换`;
    if (this.iconNode) this.iconNode.active = true;
  }

  onChanged(state: FlipState) {
    if (this.hintLabel) this.hintLabel.string = `镜像：${state}`;
    setTimeout(() => {
      if (this.iconNode) this.iconNode.active = false;
      if (this.hintLabel) this.hintLabel.string = '';
    }, 800);
  }
}
