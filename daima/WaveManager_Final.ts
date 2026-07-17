const { ccclass, property } = cc._decorator;

const DEBUG_WAVE = false;
const NORM = 0; const FAST = 1; const TANK = 2; const BOSS = 3;

const WAVE_TABLE = [
    { mix: [NORM,NORM,NORM,NORM,NORM,FAST],  mul: 1.0 },
    { mix: [NORM,NORM,NORM,FAST,FAST],          mul: 1.1 },
    { mix: [NORM,NORM,FAST,FAST,TANK],          mul: 1.2 },
    { mix: [NORM,FAST,FAST,TANK,TANK],          mul: 1.3 },
    { mix: [NORM,FAST,TANK,TANK,TANK],          mul: 1.4 },
    { mix: [FAST,FAST,TANK,TANK,TANK,BOSS],     mul: 1.0 },
    { mix: [FAST,TANK,TANK,TANK,BOSS,BOSS],     mul: 1.1 },
    { mix: [FAST,TANK,TANK,BOSS,BOSS],          mul: 1.2 },
    { mix: [TANK,TANK,BOSS,BOSS,BOSS],          mul: 1.3 },
    { mix: [BOSS,BOSS,BOSS],                    mul: 1.5 },
];

const COUNT_BASE = 6;
const MAX_WAVES = 30; // 30波后自动结束
const MIN_GAP = 0.6; const BASE_GAP = 1.5;
const WAVE_REST_SEC = 4.0;

// 波次对应分支解锁，这个数值和 MapManager 里配的一致
const BRANCH_OPEN_TABLE = [
    { branchId: 0, atWave: 4 },
    { branchId: 1, atWave: 7 },
    { branchId: 2, atWave: 10 },
];

// 压力系数
const PRESSURE_ON_SPAWN = 0.08;
const PRESSURE_SPEED_UP = 0.015; // 高压力出怪加速

// 升级概率
function calcLevelChance(wave: number): number {
    if (wave <= 3) return 0;
    let c = (wave - 3) * 0.06;
    if (c > 0.55) c = 0.55;
    return c;
}

@ccclass
export default class WaveManager extends cc.Component {

    @property(cc.Prefab) enemyPrefab: cc.Prefab = null;
    @property(cc.Node) enemyRoot: cc.Node = null;
    @property autoStart: boolean = true;

    private _map: any = null;
    private _gameRoot: any = null;

    private _waveNum: number = 0;
    private _spawning: boolean = false;
    private _spawnTimer: number = 0;
    private _aliveList: any[] = [];
    private _pendingList: Array<{ eType: number; level: number }> = [];
    private _waveRestTimer: number = 0;
    private _paused: boolean = false;

    // init

    public init(mapMgr: any, gameRoot: any) {
        this._map = mapMgr;
        this._gameRoot = gameRoot;
        // reset
        this._waveNum = 0;
        this._spawning = false;
        this._aliveList = [];
        this._paused = false;

        if (this.autoStart) {
            this.scheduleOnce(() => { this.nextWave(); }, 1.5);
        }
    }

    onDestroy() {
        this.unscheduleAllCallbacks();
    }

    // update

    update(dt: number) {
        if (this._paused) return;

        // 波间休息
        if (this._waveRestTimer > 0) {
            this._waveRestTimer -= dt;
            if (this._waveRestTimer <= 0) { this._waveRestTimer = 0; this.doStartWave(); }
            return;
        }

        if (!this._spawning) {
            this.cleanDead();

            if (this._pendingList.length === 0 && this._aliveList.length === 0) {
                if (this._waveNum <= 0) return;

                if (this._waveNum >= MAX_WAVES) {
                    if (this._gameRoot && typeof this._gameRoot.onAllWavesDone === 'function')
                        this._gameRoot.onAllWavesDone();
                    return;
                }
                if (DEBUG_WAVE) console.log('[Wave] all clear w' + this._waveNum);
                this.onWaveClear();
            }
            return;
        }

        // 出怪
        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0) {
            const info = this._pendingList.shift();
            if (info) {
                this.doOneSpawn(info.eType, info.level);
                this._spawnTimer = this._pendingList.length > 0 ? this.calcNextGap() : 0;
            }
            if (this._pendingList.length === 0) this._spawning = false;
        }
    }

    // 波次控制

    public nextWave() {
        if (this._spawning) return;
        if (this._waveNum >= MAX_WAVES) return;
        this._waveNum++;
        this._waveRestTimer = WAVE_REST_SEC;
        if (DEBUG_WAVE) console.log('[Wave] w' + this._waveNum + ' queued');
    }

    private doStartWave() {
        if (!this._map) return;

        this._map.advanceWave();
        this.openBranchesForWave();

        if (this._gameRoot && typeof this._gameRoot.onWaveStart === 'function') {
            this._gameRoot.onWaveStart(this._waveNum);
        }

        this.buildSpawnList();
        if (DEBUG_WAVE) console.log('[Wave] w' + this._waveNum + ' start ' + this._pendingList.length + ' enemies');
        this._spawnTimer = 0.5;
        this._spawning = true;
    }

    private onWaveClear() {
        if (this._gameRoot && typeof this._gameRoot.onWaveClear === 'function') {
            this._gameRoot.onWaveClear(this._waveNum);
        }
        this.scheduleOnce(() => { this.nextWave(); }, 2.0);
    }

    // 分支解锁

    private openBranchesForWave() {
        if (!this._map) return;
        for (let i = 0; i < BRANCH_OPEN_TABLE.length; i++) {
            const cfg = BRANCH_OPEN_TABLE[i];
            if (this._waveNum >= cfg.atWave) {
                this._map.openBranch(cfg.branchId);
            }
        }
    }

    // 出怪队列

    private buildSpawnList() {
        this._pendingList = [];

        const ti = this._waveNum - 1;
        const idx = ti < WAVE_TABLE.length ? ti : WAVE_TABLE.length - 1;
        const tmpl = WAVE_TABLE[idx];

        // 数量 = 基础 * 倍率 + 难度加成 + 波次递增
        let diffBonus = 0;
        if (this._map && this._waveNum > 3) {
            const diff = this._map.routeDifficulty(0, 1);
            diffBonus = Math.floor(diff * 0.3);
        }
        let baseCount = Math.floor(COUNT_BASE * tmpl.mul) + diffBonus + (this._waveNum - 1);
        if (baseCount < 3) baseCount = 3;
        // 上限防卡死
        if (baseCount > 50) baseCount = 50;

        for (let i = 0; i < baseCount; i++) {
            const eType = tmpl.mix[i % tmpl.mix.length];
            let level = 1;

            // 升级判定
            if (this._waveNum > 3) {
                const chance = calcLevelChance(this._waveNum);
                const roll = (i * 7 + this._waveNum * 13) % 100 / 100;
                if (roll < chance) { level = 2; }
            }
            // boss 后半升 L3
            const isBoss = eType === BOSS;
            if (isBoss && this._waveNum >= 8 && i > baseCount * 0.6) {
                level = 3;
            }

            this._pendingList.push({ eType, level });
        }

        // boss 排最后
        this._pendingList.sort((a, b) => {
            if (a.eType === BOSS && b.eType !== BOSS) return 1;
            if (b.eType === BOSS && a.eType !== BOSS) return -1;
            return 0;
        });
    }

    // 出怪间隔

    private calcNextGap(): number {
        let gap = BASE_GAP;

        // 波次高了出怪快
        if (this._waveNum > 5) gap -= (this._waveNum - 5) * 0.08;

        // 地图弯道多也加快
        if (this._map && this._waveNum > 3) {
            const diff = this._map.routeDifficulty(0, 1);
            gap -= diff * 0.02;
        }

        // 压力高=死怪多的地方出怪要更快
        if (this._map && this._waveNum > 4) {
            const entry = this._map.getEntry();
            const press = this._map.readPressure(entry.x, entry.y);
            gap -= press * PRESSURE_SPEED_UP * 10;
        }

        if (gap < MIN_GAP) gap = MIN_GAP;
        return gap;
    }

    // ———— 生成单个敌人 ————

    // eType 是上面的常量 (NORM/FAST/TANK/BOSS)
    private doOneSpawn(eType: number, level: number) {
        if (!this.enemyPrefab || !this.enemyRoot) {
            if (DEBUG_WAVE) console.warn('[Wave] no prefab/root');
            return;
        }

        const node = cc.instantiate(this.enemyPrefab);
        this.enemyRoot.addChild(node);

        const enemy = node.getComponent('Enemy');
        if (enemy && typeof enemy.setup === 'function') {
            enemy.setup(eType, this._waveNum, level, this._map, this._gameRoot);
            this._aliveList.push(enemy);

            // 出怪时往入口注一点压力
            if (this._map) {
                const entry = this._map.getEntry();
                this._map.pokePressure(entry.x, entry.y, PRESSURE_ON_SPAWN);
            }
        } else {
            node.destroy();
        }
    }

    // 清理

    private cleanDead() {
        this._aliveList = this._aliveList.filter(e => {
            if (!e || !e.node || !e.node.isValid) return false;
            if (!e.isAlive) return false;
            return true;
        });
    }

    // 接口

    public onEnemyDie(who: any) {
        const idx = this._aliveList.indexOf(who);
        if (idx >= 0) this._aliveList.splice(idx, 1);
    }
    public onEnemyLeak(who: any) {
        const idx = this._aliveList.indexOf(who);
        if (idx >= 0) this._aliveList.splice(idx, 1);
    }
    public get waveNum() { return this._waveNum; }
    public get aliveCount() { this.cleanDead(); return this._aliveList.length; }

    public get isSpawning() { return this._spawning; }
    public get isWaveRest() { return this._waveRestTimer > 0; }
    public pause() { this._paused = true; }
    public resume() { this._paused = false; }

    public killAll() {
        for (const e of this._aliveList) {
            if (e && e.node && e.node.isValid) { e.takeDamage(99999); }
        }
        this._pendingList = [];
        this._spawning = false;
    }
}
