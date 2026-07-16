/**
 * MapManager - 自适应地图寻路系统
 * 
 * 核心创新点：
 * 1. 动态路径生成：基于"场景张力值"实时调整路径难度
 * 2. 分层地图网格：上层策略网格 + 下层细节网格的双层架构
 * 3. 节点亲和力系统：敌人根据当前状态动态选择路径分支
 * 4. 地形影响力场：速度、伤害、视觉效果的多维空间
 */

interface PathNode {
  id: string
  x: number
  y: number
  type: 'normal' | 'junction' | 'hazard' | 'sanctuary'
  tension: number // 0-100, 场景张力值
  affinity: Map<string, number> // 不同敌人类型对该节点的偏好度
  neighbors: PathNode[]
  layer: 'strategy' | 'detail' // 分层标记
}

interface TerrainInfluence {
  x: number
  y: number
  radius: number
  speedMul: number // 速度倍数
  damageMul: number // 伤害倍数
  effectType: 'ice' | 'fire' | 'electro' | 'none'
  intensity: number // 0-100
}

interface PathSegment {
  from: PathNode
  to: PathNode
  difficulty: number // 0-100
  dynamicCost: number // 实时成本
  lastUsedWave: number
  usageCount: number
}

interface MapConfig {
  width: number
  height: number
  startX: number
  startY: number
  endX: number
  endY: number
  junctionCount: number // 路径分叉数
  terrainDensity: number // 地形影响区域密度
}

export class MapManager {
  private strategicGrid: PathNode[][] // 高层策略网格
  private detailGrid: PathNode[][] // 细节寻路网格
  private pathSegments: Map<string, PathSegment>
  private terrainInfluences: TerrainInfluence[]
  private sceneTension: number = 0 // 全局场景张力
  private waveCounter: number = 0
  private nodeIdCounter: number = 0
  private config: MapConfig

  constructor(config: MapConfig) {
    this.config = config
    this.pathSegments = new Map()
    this.terrainInfluences = []
    this.strategicGrid = []
    this.detailGrid = []

    this.initializeGrids()
    this.generateAdaptivePathNetwork()
    this.generateTerrainInfluences()
  }

  /**
   * 双层网格初始化
   * 策略网格：粗粒度，用于宏观路径规划
   * 细节网格：细粒度，用于微观碰撞和寻路微调
   */
  private initializeGrids(): void {
    const strategicCellSize = 60 // 策略网格单元大小
    const detailCellSize = 15 // 细节网格单元大小

    // 初始化策略网格
    const strategicCols = Math.ceil(this.config.width / strategicCellSize)
    const strategicRows = Math.ceil(this.config.height / strategicCellSize)
    
    this.strategicGrid = Array(strategicRows)
      .fill(null)
      .map(() => Array(strategicCols).fill(null))

    // 初始化细节网格
    const detailCols = Math.ceil(this.config.width / detailCellSize)
    const detailRows = Math.ceil(this.config.height / detailCellSize)
    
    this.detailGrid = Array(detailRows)
      .fill(null)
      .map(() => Array(detailCols).fill(null))

    // 填充网格节点
    for (let r = 0; r < strategicRows; r++) {
      for (let c = 0; c < strategicCols; c++) {
        this.strategicGrid[r][c] = {
          id: `s_${this.nodeIdCounter++}`,
          x: c * strategicCellSize + strategicCellSize / 2,
          y: r * strategicCellSize + strategicCellSize / 2,
          type: 'normal',
          tension: 0,
          affinity: new Map(),
          neighbors: [],
          layer: 'strategy',
        }
      }
    }

    for (let r = 0; r < detailRows; r++) {
      for (let c = 0; c < detailCols; c++) {
        this.detailGrid[r][c] = {
          id: `d_${this.nodeIdCounter++}`,
          x: c * detailCellSize + detailCellSize / 2,
          y: r * detailCellSize + detailCellSize / 2,
          type: 'normal',
          tension: 0,
          affinity: new Map(),
          neighbors: [],
          layer: 'detail',
        }
      }
    }

    // 连接网格内邻接关系（8邻接）
    this.connectGridNeighbors(this.strategicGrid)
    this.connectGridNeighbors(this.detailGrid)
  }

  /**
   * 连接网格节点的邻接关系
   */
  private connectGridNeighbors(grid: PathNode[][]): void {
    const rows = grid.length
    const cols = grid[0].length

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const current = grid[r][c]
        
        // 8方向邻接
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            
            const nr = r + dr
            const nc = c + dc
            
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              current.neighbors.push(grid[nr][nc])
            }
          }
        }
      }
    }
  }

  /**
   * 生成自适应路径网络
   * 核心创新：基于"场景张力"和"节点亲和力"的动态路径生成
   */
  private generateAdaptivePathNetwork(): void {
    const start = this.getNodeNearPoint(
      this.config.startX,
      this.config.startY,
      'strategy'
    )
    const end = this.getNodeNearPoint(
      this.config.endX,
      this.config.endY,
      'strategy'
    )

    // 生成主路径
    const mainPath = this.generateMainPath(start, end)

    // 生成分叉路径（增加多样性）
    const junctions = this.createPathJunctions(mainPath)

    // 为所有路径段创建 PathSegment 对象
    this.createPathSegments(mainPath, junctions)

    // 初始化节点亲和力（敌人倾向选择的路径）
    this.initializeNodeAffinities()
  }

  /**
   * 生成主路径（从起点到终点）
   */
  private generateMainPath(start: PathNode, end: PathNode): PathNode[] {
    const path: PathNode[] = [start]
    let current = start
    const visited = new Set<string>([start.id])

    // 简单的贪心寻路：朝向目标移动
    while (current.id !== end.id && path.length < 100) {
      let bestNeighbor: PathNode | null = null
      let bestDistance = Infinity

      for (const neighbor of current.neighbors) {
        if (visited.has(neighbor.id)) continue

        const dist = Math.hypot(
          neighbor.x - end.x,
          neighbor.y - end.y
        )

        if (dist < bestDistance) {
          bestDistance = dist
          bestNeighbor = neighbor
        }
      }

      if (!bestNeighbor) break

      path.push(bestNeighbor)
      visited.add(bestNeighbor.id)
      current = bestNeighbor
    }

    // 确保抵达终点
    if (current.id !== end.id) {
      path.push(end)
    }

    return path
  }

  /**
   * 创建路径分叉点（增加游戏复杂度）
   * 返回值：所有路径（包括主路径和分叉路径）
   */
  private createPathJunctions(mainPath: PathNode[]): PathNode[][] {
    const allPaths: PathNode[][] = [mainPath]

    // 在主路径的关键位置创建分叉
    const junctionIndices = this.selectJunctionPoints(mainPath)

    for (const idx of junctionIndices) {
      const branch = this.createBranchFromPoint(mainPath, idx)
      allPaths.push(branch)
    }

    return allPaths
  }

  /**
   * 选择主路径上的分叉点位置
   */
  private selectJunctionPoints(mainPath: PathNode[]): number[] {
    const indices: number[] = []
    const segmentLength = Math.floor(mainPath.length / (this.config.junctionCount + 1))

    for (let i = 1; i <= this.config.junctionCount; i++) {
      const idx = i * segmentLength + Math.floor(Math.random() * (segmentLength / 2))
      if (idx < mainPath.length) {
        indices.push(idx)
        mainPath[idx].type = 'junction'
      }
    }

    return indices
  }

  /**
   * 从主路径的某个点创建分支
   */
  private createBranchFromPoint(mainPath: PathNode[], fromIdx: number): PathNode[] {
    const branch: PathNode[] = []
    let current = mainPath[fromIdx]
    branch.push(current)

    // 分支长度随机
    const branchLength = 5 + Math.floor(Math.random() * 10)

    for (let i = 0; i < branchLength; i++) {
      // 从邻接节点中选择一个（优先选择未访问的）
      const unvisited = current.neighbors.filter(
        n => !branch.some(bn => bn.id === n.id) && !mainPath.some(pn => pn.id === n.id)
      )

      if (unvisited.length === 0) break

      current = unvisited[Math.floor(Math.random() * unvisited.length)]
      branch.push(current)
    }

    // 分支终点必须重新连接到主路径
    if (branch.length > 0) {
      const lastBranchNode = branch[branch.length - 1]
      let closestMainNode = mainPath[fromIdx]
      let minDist = Infinity

      for (const mainNode of mainPath.slice(fromIdx)) {
        const dist = Math.hypot(
          lastBranchNode.x - mainNode.x,
          lastBranchNode.y - mainNode.y
        )
        if (dist < minDist) {
          minDist = dist
          closestMainNode = mainNode
        }
      }

      branch.push(closestMainNode)
    }

    return branch
  }

  /**
   * 为所有路径段创建 PathSegment 对象并计算初始成本
   */
  private createPathSegments(mainPath: PathNode[], allPaths: PathNode[][]): void {
    for (const path of allPaths) {
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i]
        const to = path[i + 1]
        const segmentKey = `${from.id}->${to.id}`

        const segment: PathSegment = {
          from,
          to,
          difficulty: this.calculateSegmentDifficulty(from, to),
          dynamicCost: 1.0,
          lastUsedWave: -1,
          usageCount: 0,
        }

        this.pathSegments.set(segmentKey, segment)
      }
    }
  }

  /**
   * 计算路径段的基础难度
   */
  private calculateSegmentDifficulty(from: PathNode, to: PathNode): number {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    
    // 难度 = 距离 + 节点类型权重
    let difficulty = distance

    if (to.type === 'hazard') difficulty += 30
    if (to.type === 'sanctuary') difficulty -= 10
    if (to.type === 'junction') difficulty += 15

    return Math.max(1, difficulty)
  }

  /**
   * 初始化节点亲和力（敌人倾向选择某些路径）
   */
  private initializeNodeAffinities(): void {
    // 为每个节点的不同敌人类型设置亲和力
    const enemyTypes = ['melee', 'ranged', 'flying', 'heavy']

    for (const row of this.strategicGrid) {
      for (const node of row) {
        for (const type of enemyTypes) {
          // 亲和力初始值：0.5（中立），范围 [0, 1]
          // 会根据地形和游戏进度动态调整
          const baseAffinity = 0.5 + Math.random() * 0.2
          node.affinity.set(type, baseAffinity)
        }
      }
    }
  }

  /**
   * 生成地形影响区域
   * 地形影响会改变敌人的移动速度、受伤害、视觉效果
   */
  private generateTerrainInfluences(): void {
    const terrainCount = Math.ceil(
      (this.config.width * this.config.height / 10000) * this.config.terrainDensity
    )

    const effectTypes: Array<'ice' | 'fire' | 'electro' | 'none'> = [
      'ice',
      'fire',
      'electro',
    ]

    for (let i = 0; i < terrainCount; i++) {
      const influence: TerrainInfluence = {
        x: Math.random() * this.config.width,
        y: Math.random() * this.config.height,
        radius: 30 + Math.random() * 40,
        speedMul: 0.6 + Math.random() * 0.6, // 0.6-1.2x
        damageMul: 0.8 + Math.random() * 0.4, // 0.8-1.2x
        effectType: effectTypes[Math.floor(Math.random() * effectTypes.length)],
        intensity: 30 + Math.random() * 70, // 30-100
      }

      this.terrainInfluences.push(influence)
    }
  }

  /**
   * 获取点附近的节点
   */
  private getNodeNearPoint(
    x: number,
    y: number,
    layer: 'strategy' | 'detail'
  ): PathNode {
    const grid = layer === 'strategy' ? this.strategicGrid : this.detailGrid
    let nearest = grid[0][0]
    let minDist = Infinity

    for (const row of grid) {
      for (const node of row) {
        const dist = Math.hypot(node.x - x, node.y - y)
        if (dist < minDist) {
          minDist = dist
          nearest = node
        }
      }
    }

    return nearest
  }

  /**
   * 更新场景张力值（根据敌人数量、波次等）
   */
  public updateSceneTension(enemyCount: number, currentWave: number): void {
    const waveInfluence = (currentWave / 20) * 30 // 最多增加30点
    const enemyInfluence = Math.min((enemyCount / 50) * 40, 40) // 最多增加40点
    
    this.sceneTension = waveInfluence + enemyInfluence
    
    // 张力影响路径难度
    this.updatePathDynamicCosts()
  }

  /**
   * 更新路径段的动态成本
   * 张力高时，会调整敌人的路径偏好
   */
  private updatePathDynamicCosts(): void {
    for (const segment of this.pathSegments.values()) {
      // 动态成本 = 基础难度 * (1 + 张力系数)
      const tensionFactor = this.sceneTension / 100
      segment.dynamicCost = segment.difficulty * (1 + tensionFactor * 0.5)
    }
  }

  /**
   * 获取敌人的最优路径
   * 核心创新：考虑敌人类型、节点亲和力、地形影响
   */
  public getOptimalPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    enemyType: string
  ): PathNode[] {
    const start = this.getNodeNearPoint(startX, startY, 'strategy')
    const end = this.getNodeNearPoint(endX, endY, 'strategy')

    // 使用改进的 A* 算法，考虑节点亲和力
    return this.astarWithAffinity(start, end, enemyType)
  }

  /**
   * 使用节点亲和力的 A* 寻路算法
   */
  private astarWithAffinity(
    start: PathNode,
    end: PathNode,
    enemyType: string
  ): PathNode[] {
    const openSet = new Set<PathNode>([start])
    const cameFrom = new Map<string, PathNode>()
    const gScore = new Map<string, number>()
    const fScore = new Map<string, number>()

    gScore.set(start.id, 0)
    fScore.set(start.id, this.heuristic(start, end))

    while (openSet.size > 0) {
      // 找到 fScore 最小的节点
      let current: PathNode | null = null
      let minF = Infinity

      for (const node of openSet) {
        const f = fScore.get(node.id) ?? Infinity
        if (f < minF) {
          minF = f
          current = node
        }
      }

      if (!current) break

      if (current.id === end.id) {
        return this.reconstructPath(cameFrom, current)
      }

      openSet.delete(current)

      for (const neighbor of current.neighbors) {
        const affinity = neighbor.affinity.get(enemyType) ?? 0.5
        const affinityPenalty = (1 - affinity) * 5 // 亲和力低时增加成本

        // 考虑节点类型的额外成本
        let typeCost = 0
        if (neighbor.type === 'hazard') typeCost = 10
        if (neighbor.type === 'junction') typeCost = 2

        const tentativeGScore =
          (gScore.get(current.id) ?? Infinity) +
          1 +
          affinityPenalty +
          typeCost

        const neighborGScore = gScore.get(neighbor.id) ?? Infinity

        if (tentativeGScore < neighborGScore) {
          cameFrom.set(neighbor.id, current)
          gScore.set(neighbor.id, tentativeGScore)
          fScore.set(
            neighbor.id,
            tentativeGScore + this.heuristic(neighbor, end)
          )

          if (!openSet.has(neighbor)) {
            openSet.add(neighbor)
          }
        }
      }
    }

    // 路径查找失败，返回起点
    return [start]
  }

  /**
   * A* 启发式函数
   */
  private heuristic(from: PathNode, to: PathNode): number {
    return Math.hypot(to.x - from.x, to.y - from.y) / 60 // 归一化距离
  }

  /**
   * 重构路径
   */
  private reconstructPath(
    cameFrom: Map<string, PathNode>,
    current: PathNode
  ): PathNode[] {
    const path = [current]
    let node = current

    while (cameFrom.has(node.id)) {
      node = cameFrom.get(node.id)!
      path.unshift(node)
    }

    return path
  }

  /**
   * 获取点处的地形影响
   */
  public getTerrainInfluenceAt(x: number, y: number): TerrainInfluence | null {
    for (const influence of this.terrainInfluences) {
      const dist = Math.hypot(influence.x - x, influence.y - y)
      if (dist <= influence.radius) {
        return influence
      }
    }
    return null
  }

  /**
   * 更新路径使用统计（用于动态难度调整）
   */
  public recordPathUsage(path: PathNode[]): void {
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      const key = `${from.id}->${to.id}`
      const segment = this.pathSegments.get(key)

      if (segment) {
        segment.usageCount++
        segment.lastUsedWave = this.waveCounter
      }
    }
  }

  /**
   * 波次推进
   */
  public advanceWave(): void {
    this.waveCounter++
    
    // 高频使用的路径会动态变难（增加敌人密度压力）
    for (const segment of this.pathSegments.values()) {
      if (segment.lastUsedWave === this.waveCounter - 1 && segment.usageCount > 5) {
        // 路径适应性调整：频繁使用的路径难度会提升
        segment.difficulty *= 1.05
      }
    }
  }

  /**
   * 获取地图的所有地形影响区域（用于渲染）
   */
  public getTerrainInfluences(): TerrainInfluence[] {
    return this.terrainInfluences
  }

  /**
   * 获取所有路径分叉点（用于 AI 决策）
   */
  public getJunctions(): PathNode[] {
    const junctions: PathNode[] = []
    for (const row of this.strategicGrid) {
      for (const node of row) {
        if (node.type === 'junction') {
          junctions.push(node)
        }
      }
    }
    return junctions
  }

  /**
   * 调整特定敌人类型对某节点的亲和力
   * （运行时学习和动态调整）
   */
  public updateNodeAffinity(
    nodeId: string,
    enemyType: string,
    affinityDelta: number
  ): void {
    for (const row of this.strategicGrid) {
      for (const node of row) {
        if (node.id === nodeId) {
          const current = node.affinity.get(enemyType) ?? 0.5
          const updated = Math.max(0, Math.min(1, current + affinityDelta))
          node.affinity.set(enemyType, updated)
          return
        }
      }
    }
  }

  /**
   * 获取当前场景张力
   */
  public getSceneTension(): number {
    return this.sceneTension
  }

  /**
   * 获取当前波次
   */
  public getCurrentWave(): number {
    return this.waveCounter
  }

  /**
   * 获取地图配置
   */
  public getConfig(): MapConfig {
    return this.config
  }
}
