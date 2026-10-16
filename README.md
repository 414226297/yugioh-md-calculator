# 联栗炮助手（个人使用原型）

Windows PC 侧边栏，读取 MD 当前公开场面，结合自己的牌组与库存计算联栗炮方案。数据留在本地；程序不点击游戏、不替你发动卡片。

## 启动与使用

1. 双击本目录 `启动助手.cmd`。将 MD 调整为窗口模式放左侧，助手放右侧。
2. 在 MD 中打开本次使用的牌组编辑页面，等待助手读取。点击牌组状态可核对额外牌组。
3. 本次从牌组编辑界面实时获取的牌组，会自动用于紧接着的一场对局，无须再次确认。若只加载了旧缓存、游戏重启、下一场未重新获取，或实际使用了另一副牌组，请点击牌组状态核对并选择“确认用于本次对局”。
4. 主页面显示双方手牌/场上数量、对方表侧等级/阶级、可用组合和已确认的除外库存。方案仅供参照，发动及结算时仍需检查游戏实际状态。
5. 数量或怪兽数值不符时使用相应“修正”；库存不符时点击除外区的“核对”。手动值保持到恢复自动读取或下一场对局。
6. 设置中可以暂停、重连、更新卡片属性、调整窗口大小并保存本地诊断。

未知、过期、读取失败、库存不一致和场面处理中不会显示确定方案。里侧除外卡不能作为返回材料；表侧状态无法确认时需要人工核对。

## 本机依赖

当前代码通过独立子进程调用本机已安装的 Untapped Companion 原生读取模块，不包含、不复制该模块。默认位置为 `%LOCALAPPDATA%\Programs\untapped-companion\resources\app.asar.unpacked\node_modules\untapped-scry\lib\binding\napi-v5\untapped-scry.node`。可在设置中修改。游戏版本或模块变化后可能需要适配。

这是当前电脑上的开发原型，尚不是可在任意电脑安装的独立发行版。Electron、构建目录和本地依赖须保留。首次卡片属性获取需要联网，之后使用 `local-data/catalog.json` 缓存；不上传牌组或对局数据。

## 开发和检查

需要 Node.js 和 pnpm。在本目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm run test:ui
```

`pnpm run test:all` 连续执行构建、全部单元测试与 Electron 界面测试。界面测试使用独立测试数据目录，不连接游戏。

实机检查命令（需 MD 运行）：

```powershell
node scripts/check-live.mjs --deck
node scripts/test-live-app.mjs
node scripts/test-live-app.mjs --post-restart
node scripts/test-live-reconnect.mjs
node scripts/test-live-duel.mjs --initial
node scripts/test-live-duel.mjs
node scripts/test-live-duel.mjs --resolved
```

`--initial` 专用于双方起始各5张、场上均0、额外15、除外0的测试场景；`--resolved` 专用于本局一次联栗炮除外3张额外、返回其中2张、额外最终14张的场景，不能用于任意对局状态。实机脚本仅操作助手窗口，不操作游戏。

`test-results` 保存测试截图和本地实机数据。`local-data` 保存牌组、属性、设置及诊断，不要把这些目录作为发行包提交。当前验收进度见 `docs/PROGRESS.md`，需求见 `PRD.MD`。
