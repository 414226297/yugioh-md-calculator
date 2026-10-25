# MD助手：新对话交接

更新时间：2026-10-25（中国时间）。本地工作区：C:/Users/yuhaowen/Downloads/工作区02。

## 首先处理

用户要求打包EXE、重写README、保存本地Git，之后决定转入本地新对话。
前两项已完成；本地Git提交尚未完成，仍是待办，不需要重新询问授权。

当前会话对.git只有读取权限，git add及commit均报“Unable to create .git/index.lock: Permission denied”，不是遗留锁文件问题。不要删除锁文件或尝试绕过权限。用户已获知需要在有写权限的本地会话接续。
本轮重新核实最新提交仍为a3b9443（feat: add owned reader, persistent overlays and single-file Windows package），当前改动均未提交。没有推送、发布或创建Release。

新对话应：
1. 检查本地AGENTS.md及Git状态，确认当前环境允许写.git。
2. 审阅项目改动，然后提交README.md、HANDOFF.md、NEXT-CHAT.md、src、scripts、tests中的相关变更。用户已授权本地提交，不推送。
3. 成功后将新提交号写入交接记录。没有新的代码变更时不必重复打包。

## 最新交付

单文件EXE：release/md-cannon-assistant-0.3.0-win-x64-1792913268096.exe
大小：173006848字节。
SHA256：b4e3a8692300847d59b12a34bc0bdfc5123bfa722da7ea758c89e0c5961768fb
版本仍为0.3.0，同版本号旧发行包不代表当前功能，按文件名与哈希区分。

README已重写为当前功能与操作说明。打包清单补齐modules与preparation的HTML/CSS，避免发行包缺页面。
Node打包脚本在启动tar子进程时遇spawn EPERM；已直接用PowerShell调用tar.exe与.NET Framework csc.exe完成同样打包步骤。
已用新EXE的--extract-only模式验证自动展开成功，确认新页面存在；解包目录test-results/package-20261025。
单文件完整实窗启动及交互没有验收。不要把解包验证写成实窗测试通过。
release、local-data、test-results是忽略目录，不纳入Git；产物不包含私人卡组或对局数据。

## 当前功能与用户确认的要求

- 设置为主界面：启动、重复启动、托盘点击均打开设置，单实例。关闭/最小化主界面保留后台，托盘退出才真正退出。
- 侧栏只显示信息，无设置齿轮，卡组状态徽章只读。全部调整在主界面。
- 模块表是“模块名称 / 显示在侧边栏 / 显示悬浮窗”。右列仅手牌与盖牌有场上浮窗开关，其他模块必须留空，不能接成信息悬浮窗的内容选择。
- 侧栏按开启顺序排列，关闭再开追加末尾。无模块时自动隐藏；显式点击显示侧栏时如为空，恢复默认全部模块。高度按实际内容测量，受配置最大高度与屏幕工作区限制；手动隐藏不会被普通刷新立即重开。
- 最新侧栏修复：隐藏窗口可能暂停requestAnimationFrame，而主进程等待高度后才显示，形成循环等待。src/ui/app.ts已改同步测量高度，仍有去重与ResizeObserver。重启后重新开启模块的实窗回归未能运行，待确认。
- 信息悬浮窗是左下统一模块面板，有总开关。入口常驻，悬停展开内容，点击进入自身多选菜单；选择顺序决定纵向排列，不加拖动柄。底部固定，内容向上增长，有高度上限。边框2px；通过实际元素矩形向外取整裁切原生窗口，避免边线缺失。
- 手牌场上浮窗可选怪/魔/陷文字或缩略图，默认缩略图。点击在卡片信息区显示详情，不再悬停直接打开详情。
- 盖卡明确身份显示缩略图；仅一个公开候选也显示缩略图但标记“可能”及虚线边框，不写入confirmedId。无确认身份且候选为空则不显示场上浮窗。多候选仍显示提示并可点击查看。
- 所有对局浮窗等待公开ShowTurn/ShowPhase信号，后台、离开对局、暂停时隐藏。短暂读取错误保留同局记录，不清空已知信息。
- 准备页新增MD卡组状态指示器，悬停显示准备状态、名称及匹配卡表数量。通过preparationVisible/readerPid确保仅真实准备页、前台、同进程、新鲜数据时显示。
- 准备页MD图标在Untapped图标下方，中心横向对齐、约8px间距。参考1366×768坐标为x1164/y475，最大宽度202，随视口缩放。用户要求不可遮住Untapped。
- 准备页配色已按截图采样：展开区#293f24、图标背景#262321、就绪边框#35ac30。
- 默认自有只读后端无需Untapped。兼容后端依赖本机模块。新增launchUntapped默认false；切换到companion并保存时弹窗询问以后是否联动启动，默认/取消均关闭。程序路径按常见安装位置和模块根目录推导，联动启动未实机验证。

## 验证记录

本次打包前构建通过。最近21项针对性测试通过，涉及sidebar-layout、display-settings、preparation-indicator、overlay-style、modules、overlay-start。
旧的其他通过记录仅属历史，不能代替新改动验证。
新增scripts/test-sidebar-restart.mjs覆盖关闭模块→退出→重启→开启；本环境启动Electron被spawn EPERM阻止。
同样有test-settings、test-modules、test-preparation-indicator等UI脚本。没有为了验收启动游戏读取。

## 开发入口

- src/desktop/main.ts：主界面/侧栏生命周期、配置IPC、联动启动。
- src/desktop/card-overlay.ts：场上浮窗、100号信息浮窗、101号准备页指示器。
- src/ui/app.ts、sidebar.ts：设置及侧栏渲染、高度测量。
- src/ui/modules.*、preparation.*、overlay.*：各浮窗页面。
- src/domain/modules.ts、sidebar-layout.ts、preparation-indicator.ts、overlay-layout.ts：选择、显示状态、布局。
- scripts/package-portable.mjs、native/portable/Launcher.cs：单EXE生成。
- HANDOFF.md：完整历史细节；README.md：当前用户说明。

## 工作约定

日常修改只构建，明确要求才打包；交付必须是可单独复制运行的EXE，不是仅Electron主程序。
若pnpm不可用，可依次运行node node_modules/typescript/bin/tsc、node scripts/copy-ui.mjs、node scripts/build-owned-reader.mjs。
针对性测试使用node --test --test-isolation=none指定文件，控制耗时。不要无新理由反复尝试已受限的测试。
需要用户打开或操作游戏时先说明并等待回复；不主动读取游戏，不注入或改写，不读取对方未公开身份。
保留无关目录与私人数据，不打包进发行版。未授权不推送或发布。
用户反馈更新没生效时，先确认退出托盘旧进程并运行新EXE或工作区启动助手.cmd，不要立刻发起游戏检测。
