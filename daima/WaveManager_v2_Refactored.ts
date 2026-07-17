const { ccclass, property } = cc._decorator;

const DEBUG_WAVE = false;

// =========================================================================
//  类型定义
// =========================================================================

/**
 * MapManager 接口 — 定义 WaveManager 依赖的 map 方法
 */
interface IMapManager {
    advanceWave(): void;
    openBranch(id: number): void;
    getActiveBranches(): Array<{ id: number }>;
    routeDifficulty(tStart: number, tEnd: number): number;
    getEntry(): { x: number; y: number };
    pokePressure(x: number, y: number, amount: number): void;
    readPressure(x: number, y: number): number;
}

/**
 * GameRoot 接口 — 定义 WaveManager 依赖的游戏管理器方法
 */
interface IGameRoot {
    onWaveStart(waveNum: number): void;
    onWaveClear(waveNum: number): void;
    onAllWavesDone(): void;
}

/**
 * Enemy 组件接口 — 定义敌人的接口
 */
interface IEnemy {
    isAlive: boolean;
    node: cc.Node;
    setup(eType: number, wave: number, level: number, map: IMapManager, gameRoot: IGameRoot): void;
    takeDamage(damage: number): void;
}

// =========================================================================
//  敌人类型常量
// =========================================================================

const T_NORMAL = 0;
const T_FAST = 1;
const T_TANK = 2;
const T_BOSS = 3;

// =========================================================================
//  波次配置
// =========================================================================

const WAVE_TABLE = [
    { mix: [T_NORMAL, T_NORMAL, T_NORMAL, T_NORMAL, T_NORMAL, T_FAST], mul: 1.0 },
    { mix: [T_NORMAL, T_NORMAL, T_NORMAL, T_FAST, T_FAST], mul: 1.1 },
    { mix: [T_NORMAL, T_NORMAL, T_FAST, T_FAST, T_TANK], mul: 1.2 },
    { mix: [T_NORMAL, T_FAST, T_FAST, T_TANK, T_TANK], mul: 1.3 },
    { mix: [T_NORMAL, T_FAST, T_TANK, T_TANK, T_TANK], mul: 1.4 },
    { mix: [T_FAST, T_FAST, T_TANK, T_TANK, T_TANK, T_BOSS], mul: 1.0 },
    { mix: [T_FAST, T_TANK, T_TANK, T_TANK, T_BOSS, T_BOSS], mul: 1.1 },
    { mix: [T_FAST, T_TANK, T_TANK, T_BOSS, T_BOSS], mul: 1.2 },
    { mix: [T_TANK, T_TANK, T_BOSS, T_BOSS, T_BOSS], mul: 1.3 },
    { mix: [T_BOSS, T_BOSS, T_BOSS], mul: 1.5 },
];

const COUNT_BASE = 6;
const MAX_WAVES = 30;
const SPAWN_MIN_GAP = 0.6;
const SPAWN_BASE_GAP = 1.5;
const WAVE_REST_SEC = 4.0;

// =========================================================================
//  分支解锁配置
// =========================================================================

const BRANCH_OPEN_TABLE = [
    { branchId: 0, atWave: 4 },
    { branchId: 1, atWave: 7 },
    { branchId: 2, atWave: 10 },
];

// =========================================================================
//  压力系数
// =========================================================================

const PRESSURE_PER_SPAWN = 0.08;
const PRESSURE_GAP_REDUCE = 0.015;

// =========================================================================
//  工具函数
// =========================================================================

/**
 * 检查接口方法是否存在
 * 替代 typeof xxx === 'function' 的散落调用
 */
function hasMethod<T extends Record<string, any>>(obj: T | null | undefined, methodName: keyof T): obj is T & Record<keyof T, Function> {
    return obj !== null && obj !== undefined && typeof obj[methodName] === 'function';
}

/**
 * 安全调用接口方法
 * 如果对象或方法不存在，返回 false，避免错误
 */
function safeCall<T extends Record<string, any>, K extends keyof T>(
    obj: T | null | undefined,
    methodName: K,
    ...args: any[]
): boolean {
    if (hasMethod(obj, methodName)) {
        try {
            (obj[methodName] as any)(...args);
            return true;
        } catch (e) {
            if (DEBUG_WAVE) console.error(`[Wave] Error calling ${String(methodName)}:`, e);
            return false;
        }
    }
    return false;
}

/**
 * 波次升级概率曲线
 * wave 3: 0%, wave 5: 12%, wave 10: 42%, wave 15+: 55%
 */
function levelUpChance(wave: number): number {
    if (wave <= 3) return 0;
    let c = (wave - 3) * 0.06;
    if (c > 0.55) c = 0.55;
    return c;
}

// =========================================================================

@ccclass
export default class WaveManager extends cc.Component {

    @property(cc.Prefab) enemyPrefab: cc.Prefab = null;
    @property(cc.Node) enemyRoot: cc.Node = null;
    @property autoStart: boolean = true;

    // ---- 依赖注入（使用接口而不是 any）----
    private _map: IMapManager | null = null;
    private _gameRoot: IGameRoot | null = null;

    // ---- 运行时状态 ----
    private _waveNum: number = 0;
    private _spawning: boolean = false;
    private _spawnTimer: number = 0;
    private _aliveList: IEnemy[] = [];
    private _pendingList: Array<{ eType: number; level: number }> = [];
    private _waveRestTimer: number = 0;
    private _paused: boolean = false;

    // ———— 初始化 ————

    /**
     * 初始化 WaveManager
     * @param mapMgr MapManager 实例（使用接口类型）
     * @param gameRoot GameRoot 实例（使用接口类型）
     */
    public init(mapMgr: IMapManager | null, gameRoot: IGameRoot | null) {
        this._map = mapMgr;
        this._gameRoot = gameRoot;
        this._waveNum = 0;
        this._spawning = false;
        this._aliveList = [];

        if (this.autoStart) {
            this.scheduleOnce(() => { this.nextWave(); }, 1.5);
        }
    }

    // ———— 每帧更新 ————

    update(dt: number) {
        if (this._paused) return;

        // 波间休息
        if (this._waveRestTimer > 0) {
            this._waveRestTimer -= dt;
            if (this._waveRestTimer <= 0) {
                this._waveRestTimer = 0;
                this.doStartWave();
            }
            return;
        }

        if (!this._spawning) {
            this.cleanDead();

            if (this._pendingList.length === 0 && this._aliveList.length === 0) {
                if (this._waveNum <= 0) return;

                if (this._waveNum >= MAX_WAVES) {
                    safeCall(this._gameRoot, 'onAllWavesDone');
                    return;
                }
                if (DEBUG_WAVE) console.log('[Wave] all clear w' + this._waveNum);
                this.onWaveClear();
            }
            return;
        }

        // 出怪计时
        this._spawnTimer -= dt;
        if (this._spawnTimer <= 0 && this._pendingList.length > 0) {
            const info = this._pendingList.shift();
            if (info) {
                this.doOneSpawn(info.eType, info.level);
                this._spawnTimer = this._pendingList.length > 0 ? this.calcNextGap() : 0;
            }
            if (this._pendingList.length === 0) this._spawning = false;
        }
    }

    // ———— 波次控制 ————

    /**
     * 触发下一波敌人
     */
    public nextWave() {
        if (this._spawning) return;
        if (this._waveNum >= MAX_WAVES) return;
        this._waveNum++;
        this._waveRestTimer = WAVE_REST_SEC;
        if (DEBUG_WAVE) console.log('[Wave] w' + this._waveNum + ' queued');
    }

    /**
     * 内部：开始当前波的生成
     */
    private doStartWave() {
        if (!this._map) return;

        // 通知地图推进波次
        safeCall(this._map, 'advanceWave');
        
        // 检查分支解锁
        this.openBranchesForWave();

        // 通知游戏管理器
        safeCall(this._gameRoot, 'onWaveStart', this._waveNum);

        // 生成敌人队列
        this.buildSpawnList();
        if (DEBUG_WAVE) console.log('[Wave] w' + this._waveNum + ' start ' + this._pendingList.length + ' enemies');
        
        this._spawnTimer = 0.5;
        this._spawning = true;
    }

    /**
     * 当前波全部敌人死亡后触发
     */
    private onWaveClear() {
        safeCall(this._gameRoot, 'onWaveClear', this._waveNum);
        this.scheduleOnce(() => { this.nextWave(); }, 2.0);
    }

    // ———— 分支管理 ————

    /**
     * 根据当前波次，检查并打开应该开启的分支
     */
    private openBranchesForWave() {
        if (!this._map) return;
        for (let i = 0; i < BRANCH_OPEN_TABLE.length; i++) {
            const cfg = BRANCH_OPEN_TABLE[i];
            if (this._waveNum >= cfg.atWave) {
                safeCall(this._map, 'openBranch', cfg.branchId);
            }
        }
    }

    // ———— 出怪队列生成 ————

    /**
     * 根据当前波次配置，生成敌人队列
     */
    private buildSpawnList() {
        this._pendingList = [];

        const idx = this._waveNum - 1 < WAVE_TABLE.length ? this._waveNum - 1 : WAVE_TABLE.length - 1;
        const tmpl = WAVE_TABLE[idx];

        // 计算基础数量
        let diffBonus = 0;
        if (this._map && this._waveNum > 3) {
            const diff = this._map.routeDifficulty(0, 1);
            diffBonus = Math.floor(diff * 0.3);
        }
        let baseCount = Math.floor(COUNT_BASE * tmpl.mul) + diffBonus + (this._waveNum - 1);
        if (baseCount < 3) baseCount = 3;
        if (baseCount > 50) baseCount = 50;

        // 生成敌人列表
        for (let i = 0; i < baseCount; i++) {
            const eType = tmpl.mix[i % tmpl.mix.length];
            let level = 1;

            // 升级判定
            if (this._waveNum > 3) {
                const chance = levelUpChance(this._waveNum);
                const roll = (i * 7 + this._waveNum * 13) % 100 / 100;
                if (roll < chance) {
                    level = 2;
                }
            }
            
            // Boss 后半升 L3
            if (eType === T_BOSS && this._waveNum >= 8 && i > baseCount * 0.6) {
                level = 3;
            }

            this._pendingList.push({ eType, level });
        }

        // Boss 排最后
        this._pendingList.sort((a, b) => {
            if (a.eType === T_BOSS && b.eType !== T_BOSS) return 1;
            if (b.eType === T_BOSS && a.eType !== T_BOSS) return -1;
            return 0;
        });
    }

    // ———— 出怪间隔计算 ————

    /**
     * 计算下一只敌人的出怪间隔
     * 受波数、地图难度、压力等因素影响
     */
    private calcNextGap(): number {
        let gap = SPAWN_BASE_GAP;

        // 波数越多，出怪越快
        if (this._waveNum > 5) {
            gap -= (this._waveNum - 5) * 0.08;
        }

        // 地图难度越高，出怪越快
        if (this._map && this._waveNum > 3) {
            const diff = this._map.routeDifficulty(0, 1);
            gap -= diff * 0.02;
        }

        // 地图压力越高，出怪越快
        if (this._map && this._waveNum > 4) {
            const entry = this._map.getEntry();
            const press = this._map.readPressure(entry.x, entry.y);
            gap -= press * PRESSURE_GAP_REDUCE * 10;
        }

        return Math.max(SPAWN_MIN_GAP, gap);
    }

    // ———— 敌人生成 ————

    /**
     * 生成单个敌人实例
     * @param eType 敌人类型
     * @param level 敌人等级
     */
    private doOneSpawn(eType: number, level: number) {
        if (!this.enemyPrefab || !this.enemyRoot) {
            if (DEBUG_WAVE) console.warn('[Wave] no prefab/root');
            return;
        }

        const node = cc.instantiate(this.enemyPrefab);
        this.enemyRoot.addChild(node);

        // 获取 Enemy 组件，并检查接口兼容性
        const enemyComponent = node.getComponent('Enemy');
        const enemy = enemyComponent as IEnemy | null;

        if (enemy && hasMethod(enemy, 'setup')) {
            // 调用 setup，传入接口类型的参数
            enemy.setup(eType, this._waveNum, level, this._map, this._gameRoot);
            this._aliveList.push(enemy);

            // 出怪时往入口注入压力
            if (this._map) {
                const entry = this._map.getEntry();
                safeCall(this._map, 'pokePressure', entry.x, entry.y, PRESSURE_PER_SPAWN);
            }
        } else {
            if (DEBUG_WAVE) console.warn('[Wave] Enemy component not found or setup method missing');
            node.destroy();
        }
    }

    // ———— 清理死敌人 ————

    /**
     * 清理列表中已死亡或无效的敌人
     */
    private cleanDead() {
        this._aliveList = this._aliveList.filter(e => {
            if (!e || !e.node || !e.node.isValid) return false;
            if (!e.isAlive) return false;
            return true;
        });
    }

    // ———— 外部接口 ————

    /**
     * 敌人死亡回调，从存活列表中移除
     */
    public onEnemyDie(who: IEnemy) {
        const idx = this._aliveList.indexOf(who);
        if (idx >= 0) this._aliveList.splice(idx, 1);
    }

    /**
     * 敌人逃离回调，从存活列表中移除
     */
    public onEnemyLeak(who: IEnemy) {
        const idx = this._aliveList.indexOf(who);
        if (idx >= 0) this._aliveList.splice(idx, 1);
    }

    /**
     * 获取当前波次号
     */
    public get waveNum(): number { return this._waveNum; }

    /**
     * 获取存活敌人数量
     */
    public get aliveCount(): number {
        this.cleanDead();
        return this._aliveList.length;
    }

    /**
     * 是否正在出怪中
     */
    public get isSpawning(): boolean { return this._spawning; }

    /**
     * 波次间是否在休息
     */
    public get isWaveRest(): boolean { return this._waveRestTimer > 0; }

    /**
     * 暂停波次
     */
    public pause() { this._paused = true; }

    /**
     * 恢复波次
     */
    public resume() { this._paused = false; }

    /**
     * 强制杀死所有敌人（调试用）
     */
    public killAll() {
        for (const e of this._aliveList) {
            if (e && e.node && e.node.isValid && hasMethod(e, 'takeDamage')) {
                e.takeDamage(99999);
            }
        }
        this._pendingList = [];
        this._spawning = false;
    }
}
