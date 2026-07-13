import { Vec2 } from 'cc';
import { FlipState } from './FlipManager';

export function mapInputToWorld(input: Vec2, state: FlipState): Vec2 {
  if (!input) return new Vec2();
  switch (state) {
    case FlipState.Identity:
      return input.clone();
    case FlipState.MirrorX:
      return new Vec2(-input.x, input.y);
    case FlipState.MirrorY:
      return new Vec2(input.x, -input.y);
    case FlipState.DiagPos:
      return new Vec2(input.y, input.x);
    case FlipState.DiagNeg:
      return new Vec2(-input.y, -input.x);
    default:
      return input.clone();
  }
}

// 将 Vec2 方向映射成 4 向（上/下/左/右）方向枚举
export enum Dir4 { Up = 0, Right = 1, Down = 2, Left = 3 }

export function vecToDir4(v: Vec2): Dir4 | null {
  if (!v) return null;
  const ax = Math.abs(v.x), ay = Math.abs(v.y);
  if (ax < 0.3 && ay < 0.3) return null;
  if (ax > ay) return v.x > 0 ? Dir4.Right : Dir4.Left;
  return v.y > 0 ? Dir4.Up : Dir4.Down;
}
