# 单文件便携启动器

`pnpm run package:portable` 将 Electron、应用和原创 MemoryHost 内嵌到一个 Windows x64 EXE。最终文件在 `release/`；中间目录、内嵌 ZIP 和构建校验信息位于忽略目录 `local-data/portable-build/`。

双击自动展开到 `%LOCALAPPDATA%\md-cannon-assistant\portable\<内嵌ZIP的SHA256>`，核对 ICU 后启动；相同版本复用缓存，新的包使用独立目录。配置仍保存在 `%APPDATA%\md-cannon-assistant`。无须安装 Node.js 或 Untapped。启动器和读取程序均使用 Windows .NET Framework 4.x。

启动器校验内嵌 ZIP 的 SHA256、限定解压路径、串行准备同一缓存、完整展开后才发布缓存，并转发命令行和退出码。`--extract-only` 可用于检查内嵌文件；环境变量 `MD_PORTABLE_CACHE` 可为测试指定绝对缓存目录。

运行 `node scripts/test-single-exe.mjs <单文件EXE路径>` 做隔离解包/启动检查，不连接游戏。
