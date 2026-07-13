// 简单 localStorage 排行榜（存 top 5）
const KEY = 'mirror-maze-leaderboard-v1';
export type Entry = { name: string; score: number; time: number };

export function loadLeaderboard(): Entry[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Entry[];
  } catch {
    return [];
  }
}

export function saveEntry(e: Entry) {
  const list = loadLeaderboard();
  list.push(e);
  list.sort((a, b) => b.score - a.score || a.time - b.time);
  const top = list.slice(0, 5);
  localStorage.setItem(KEY, JSON.stringify(top));
}
