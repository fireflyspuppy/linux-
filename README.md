# Tank Trouble - 坦克动荡

双人对战坦克游戏，支持**在线联机**和**人机对战**。坦克在随机生成的迷宫中移动、射击，子弹碰到墙壁会反弹，率先击中对手得分。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML5 Canvas + 原生 JavaScript |
| 后端 | Node.js + Express |
| 实时通信 | WebSocket (Socket.IO) |
| 数据库 | SQLite（本地）/ PostgreSQL（Docker 生产环境） |
| 容器化 | Docker + docker-compose |
| 反向代理 | Nginx |
| AI | 状态机 + A* 寻路 |

## 快速开始

### 本地开发

```bash
cd server
npm install
npm start
```

访问 `http://localhost:3000`

服务端默认使用 SQLite，无需额外配置数据库。

### Docker 部署

```bash
docker-compose up -d
```

启动三个容器：PostgreSQL 数据库、Node.js 服务端、Nginx 客户端代理。

## 项目结构

```
tank-trouble/
├── client/                    # 前端
│   ├── Dockerfile
│   ├── nginx.conf
│   └── public/
│       ├── index.html         # 入口页面
│       ├── css/style.css      # UI 样式
│       └── js/
│           ├── main.js        # 应用入口
│           ├── config.js      # 客户端常量
│           ├── utils.js       # 向量工具函数
│           ├── input.js       # 输入管理（WASD + 空格）
│           ├── network.js     # Socket.IO 客户端封装
│           ├── renderer.js    # Canvas 渲染器
│           ├── gameClient.js  # 服务端状态消费 & 输入发送
│           └── screens/       # 界面切换
│               ├── menuScreen.js      # 主菜单
│               ├── lobbyScreen.js     # 匹配等待
│               ├── gameScreen.js      # 游戏界面
│               └── gameOverScreen.js  # 结算界面
├── server/                    # 后端
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js           # 服务入口
│       ├── config.js          # 游戏参数配置
│       ├── db.js              # SQLite 数据库模块
│       ├── routes/leaderboard.js    # 排行榜 REST API
│       ├── socket/handlers.js       # Socket.IO 事件处理
│       ├── matchmaking/MatchMaker.js # 在线匹配 + AI 对战
│       ├── game/
│       │   ├── constants.js   # 游戏常量
│       │   ├── Tank.js        # 坦克实体
│       │   ├── Bullet.js      # 子弹实体
│       │   ├── Physics.js     # 碰撞检测
│       │   ├── MazeGen.js     # 迷宫生成
│       │   ├── GameRoom.js    # 房间管理
│       │   └── GameLoop.js    # 游戏循环状态机
│       └── ai/
│           ├── AIController.js # AI 状态机
│           └── Pathfinding.js  # A* 寻路
└── sql/
    └── init.sql               # PostgreSQL 建表脚本
```

## 游戏规则

- 两名玩家在**随机生成的迷宫**中对战
- 子弹碰到墙壁会**反弹**（最多 15 次反弹）
- 击中对手得 1 分
- 每局 **60 秒**，分数高者获胜
- 被击杀后 **3 秒重生**，重生后有 **2 秒无敌护盾**

## AI 说明

AI 使用状态机控制，包含 6 个状态：

- **IDLE** — 待机
- **PATROL** — 巡逻
- **CHASE** — 追击
- **AIM** — 瞄准
- **SHOOT** — 射击
- **DODGE** — 躲避子弹

使用 A* 寻路算法在迷宫中导航。反应延迟 (200-500ms) 和瞄准精度随机化，让 AI 行为不那么可预测。

## 游戏操作

| 按键 | 操作 |
|------|------|
| W/A/S/D | 移动 |
| 空格 | 射击 |
| 鼠标 | 菜单交互 |
