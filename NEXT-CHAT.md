# MD助手：新对话交接

更新时间：2026-10-30（中国时间）。本地工作区：C:/Users/yuhaowen/Downloads/工作区02。

## 新版对局读取复核（2026-10-30）

同日 Untapped 更新检查：本机3.12.3-latest / ProductVersion 3.12.3.0，untapped-scry 6.16.0，安装目录、进程名与napi-v5模块路径未变。模块实际加载成功，Scry.connect与Il2CppScry.getMetadataContext接口存在；进程检测经权限升级实测running=true，未启动或关闭Untapped。本机UnityPlayer版本为6000.3.18f1，已修正config默认值、worker回退、check-live脚本及打包说明中的旧6000.0.61f1。保留用户已保存的版本设置，旧配置需在高级设置手动改为6000.3.18f1。编译/UI复制、6项模块/联动测试及5项配置/可移植测试通过。本轮未连接游戏，不能据此声称第三方兼容后端对局读取通过；后续遵循页面就绪确认约定再测。未打包、提交或发布。

用户确认进入对局后，只读采样4次均成功：我方手牌6、对方5、双方场上0，公开日志22条；首帧busy=true，后三帧false，暖读取389–442ms。未读取对方未公开身份、未自动操作游戏。私人汇总在local-data/owned-reader/duel-verification-20261030.json。

此前另一场面4次读取也成功（我方手牌6、对方3、对方场上2、日志48条），但暖读取约1.5秒加轮询间隔触发旧2秒阈值，持续busy。现finalizeOwned在内存一致性复核后不再因采样间隔长判忙，仍检查场面变化与时间回退；兼容后端保留2秒规则，消费端新鲜度检查不变。编译、UI资源复制及14项元数据/上下文/稳定性测试通过。新版菜单、牌组及静态对局链路已有实机证据，动态效果全过程、浮窗点击及长日志性能未完整验收。未打包、提交或发布；旧发行EXE不包含修复。本段覆盖下文“尚待进入对局”的历史状态。

## MD大更新适配（2026-10-29）

后续用户确认进入牌组编辑页：首次报Type handle invalid，已将运行时typeClass中固定4字节的byvalTypeIndex读取改为元数据声明宽度。随后出现一次Invalid read bounds，页面切换过程中未能确定根因，保留观察。之后调试包装检查连续两次返回editor、卡表valid；正常OwnedReader再次连续两次返回preparation、卡表valid，两次都是主牌44/额外15（牌组详情仅留local-data/owned-reader/deck-verification-20261029.json）。页面由用户切换，未自动操作游戏。新增1/2/4字节运行时类型索引回归，9项上下文/元数据测试通过。尚待用户确认进入对局后验证公开日志、数量与浮窗；不要宣称完整对局适配通过。未打包、提交或发布。

本机Steam build 26285703，GameAssembly SHA256为9248d99205f6a35a53b53076d53e06fa4c353e07052fd41277cab18f370740f6。元数据由v31变为v39，新增三整数section header及变长类型/泛型容器索引。metadata.ts已支持两版并验证section计数，保留旧版；格式参考Cpp2IL development Metadata定义。依据新版il2cpp_image_get_class相关导出代码推导类型表RVA=66100576，已在用户授权的主菜单中验证菜单类及视图栈；context.ts按哈希登记新旧两套地址，不取消未知版本保护。

完整OwnedReader连续两次成功返回menu、logLength=0。TypeScript编译、8项元数据/上下文测试通过（含v39三种索引宽度、计数损坏拒绝），UI资源已复制。此前15项读取相关基线测试通过。新版牌组、准备页、对局公开日志与浮窗尚未实机验证；不可称完整适配验收。只读主菜单许可已获得；请先请求用户进入牌组编辑页并等确认再做下一阶段。未打包、提交或发布。参考和临时检查脚本在local-data/owned-reader，不能随发行包分发游戏文件。

## 设置页模块分组（最新）

用户要求简练并集中侧栏开关。设置页改为侧边栏、公开手牌、盖牌、信息悬浮窗、读取与启动五组，取代旧三列表格。侧栏开关集中，宽高及主题归入侧栏；手牌样式、盖牌偏移归入各自模块；路径、Unity版本、读取间隔及诊断折叠到高级区。开关/手牌样式仍即时保存，其余字段通过form关联统一底部保存，保留草稿。TypeScript编译及UI复制通过；隔离MD_TEST_MODE实窗测试经权限升级通过，覆盖开关、侧栏排序、手牌样式、表单字段完整性、草稿保留、实际保存及重开，截图test-results/settings-grouped.png已目视检查。测试未读取游戏或启动Untapped。未打包、提交或发布。

## 2026-10-27 盖牌浮窗遮挡选牌修复

最新尺寸调整：用户红框指出28×41过小，参考1360×765尺寸放大到40×58，保持中心、点击详情及原生窗口裁切；四周保留游戏牌面。编译、UI复制和8项样式/布局测试通过，未实窗验证、未打包或发布。本段尺寸优先于下方历史尺寸。

最新纠正（优先于下方穿透方案）：用户要求保留浮窗点击功能，保持卡片中心，四周留出游戏选牌空间。已撤销盖牌setIgnoreMouseEvents(true)，保持28×41小图并改为围绕参考y=124缩放（不再固定底边导致缩小后偏下），文字提示也垂直居中。原生setShape仍限定到提示实际尺寸。点击浮窗查看详情，四周牌面交给游戏。编译及8项布局/样式测试通过，未进行游戏实窗验证；未打包或发布。

### 同日：联动启动去重与等级推断评估

修复launchUntapped无条件spawn：新增desktop/companion-launch.ts，用tasklist CSV检查Untapped.gg Companion.exe / Untapped Companion.exe，已运行时直接跳过；异步调用合并且本次助手运行中最多启动一次；检查失败则提示而不盲目启动。测试模式禁止联动。TypeScript编译、UI复制、5项针对性测试通过。只读实机检查经权限升级成功返回Untapped running: true，未启动或关闭Untapped，未读取游戏。尚未重新打包、提交或发布。

等级推断可行性结论：保留普通怪兽等级、迁移旧卡片缓存及按已验证条件筛选候选可实现；难点是当前HandChange丢失动作种类、祭品关联及特殊效果上下文，不能只凭“没有看到祭品”证明高星怪兽不可能离手。建议先支持公开证据完整、已验证的通常盖放场景；祭品、等级改变、免祭品与效果盖放需明确建模，未知效果保守回退为候选。暂不实现全卡效果规则引擎。此轮仅评估，未实现等级推断。

### 同日：里侧放置怪兽后手牌浮窗记录消失

后续用户纠正：若公开证据可确认是无需祭品的通常盖放，且没有等级改变、免祭品或效果放置等例外，5星以上已知怪兽应排除出此次离手候选，其确定手牌记录应保留，不能一律降为候选。当前尚未实现该规则推断：parseCatalog将普通怪兽kind=other的value置0，未单独保留等级；HandChange只保留匿名leave，未保留可验证的通常/上级/效果放置及例外证据。现有修复只处理候选不显示，不能称已完成等级规则过滤。后续应补充公开证据链再过滤，不可只因未看到祭品就断言没有例外。

复现4张手牌（2张已知怪兽、2张未知）匿名离手：领域层原本保留uncertainCards，但CardOverlay只渲染cards，两个不同名字的确认数量都变零后浮窗全消失。新增handOverlayEntries同时展示确认记录及候选，候选复用“可能”标记与虚线框，点击详情不赋confirmedId；浮窗条目不超过当前手牌数，完整候选仍在信息悬浮窗中。同名两张保留至少一张确定记录。增加从公开移动解码、DuelStore到浮窗条目的回归测试，包含重复帧及后续公开离手。编译、UI复制及37项相关测试通过；未实窗验收、未读游戏、未打包或提交。此记录优先于下方旧行为。

用户截图反馈盖牌缩略图太大、挡住游戏选牌。盖牌缩略图参考1360×765尺寸由48×70缩至28×41，保持中心及底边定位；7–11号盖牌提示窗口使用setIgnoreMouseEvents(true)，点击穿透到游戏。盖牌详情改由信息悬浮窗盖牌模块点击查看，手牌点击行为不变。本轮TypeScript编译、UI资源复制及8项样式/布局测试通过；鼠标穿透未进行实窗验证，未读取游戏。仅构建，未打包、提交或发布此修复。

此前2026-10-25已将main推送至986f7b4，并发布v0.3.0-20261025，EXE及SHA256上传核验一致；该发行版不包含本次修复。下方“未推送”是当时的历史记录。

## 本地提交已完成（2026-10-25）

已通过权限升级完成原先受限的本地 Git 提交：`cca1e6d`（feat: add settings main window and configurable duel overlays），共43个项目文件。未推送、发布或创建Release；release、local-data、test-results未纳入提交。

提交前暂存差异格式检查通过。本轮未修改代码、未重新打包或重复测试；下方构建、单测与实窗限制记录继续适用。本段及HANDOFF中的提交结果另作后续文档提交。原本地提交待办已关闭。

## 原交接待办（已完成，保留历史）

用户要求打包EXE、重写README、保存本地Git，之后决定转入本地新对话。
原交接时前两项已完成；本地Git提交当时尚未完成，现已完成，见上方记录。

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

## Untapped兼容后端主菜单实测（2026-10-30）

用户明确确认已进入主菜单；通过更新后的untapped-scry 6.16.0及Unity 6000.3.18f1，连续两次运行check-live均成功返回menu，事件0、对局计数null、牌组null，符合主菜单状态。已验证实际连接和主菜单结构读取，尚未验证该第三方后端新版牌组/对局链路；不得称完整兼容验收。未修改游戏、未打包或发布。

## Untapped兼容后端牌组实测（2026-10-30）

用户确认进入牌组后，更新后的第三方后端连续两次读取成功：加速均主牌44、额外15（15种）。两次均通过validateDeck，完整main/extra映射完全一致。Snapshot状态menu代表非对局，deck字段正常存在。私人首帧在local-data/owned-reader/companion-deck-first.json。尚未验证新版第三方后端对局链路；未打包、提交或发布。

## Untapped兼容后端对局实测（2026-10-30）

用户确认进入对局后，新版Untapped兼容模块连续4次读取成功，status=duel、duelStarted=true：我方手牌2/场上3，对方手牌3/场上2；公开日志74条且completeLog=true，我方移动15、公开手牌变化9。首帧busy=true，后3帧false，耗时14–23ms，未见读取异常。公开确认/候选手牌均0，本次不能验证实际展示身份后的保持与离手；场上浮窗点击和动态效果全过程也未验收。私人汇总local-data/owned-reader/companion-duel-verification-20261030.json。结合此前菜单/牌组验证，新版第三方后端基本读取链路通过；未打包、提交或发布。

## 配置维护优化（2026-10-30）

用户授权自主优化并使用较低级别模型测试。新增reader/version.ts作为默认Unity版本唯一来源，设置、worker、现场检查和打包说明统一引用；check-live支持MD_UNITY_VERSION覆盖。构建通过。gpt-6-luna执行离线回归：首轮60项通过，ReaderHost子进程测试最初spawn EPERM，经权限升级复测通过；配置/可移植/启动12项复测及两个脚本语法检查通过。原生模块可选测试跳过，本轮未读游戏。未打包、提交或发布。

## 最新单文件打包（2026-10-30）

用户明确要求打包，构建及package-portable成功。最新EXE为release/md-cannon-assistant-0.3.0-win-x64-1793329590305.exe，173009408字节，SHA256 40bd49e68ec16fb2d7890ee232e0c20ff4db4c780f7077d9aacae862ef215a2f，同目录有sha256文件。包含当前工作区MD适配、设置和浮窗等修复，仍版本0.3.0。GPT-6 Luna完成隔离目录单独复制/--extract-only验证，退出码0、.complete存在，新版版本配置、v39解析及UI资源和自有helper齐全；未发现第三方模块或私人数据目录。未验收此EXE的正常实窗启动；未提交、推送或发布GitHub Release。请优先使用本段新产物，下文旧产物是历史。

## 0.3.1发布准备（2026-10-30）

用户授权更新版本、本地Git、推送GitHub及Releases。package.json/README更新为0.3.1，重新构建release/md-cannon-assistant-0.3.1-win-x64-1793331139864.exe，SHA256 bda7f17e64155cf2ddb7cfe2746eae054002a19c8bbcbb3d81ed260a80fb3001。发行仅上传EXE与sha256，不包括私人数据或工作区额外安装器。
