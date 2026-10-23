// Copyright (c) 2026 璀璨星空. MIT. Single-file portable bootstrapper.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("MD助手")]
[assembly: AssemblyProduct("MD助手")]
[assembly: AssemblyVersion("__ASSEMBLY_VERSION__")]
internal static class Launcher {
 const string PayloadHash = "__PAYLOAD_SHA256__";
 const string PayloadRoot = "__PAYLOAD_ROOT__";
 const string IcuHash = "__ICU_SHA256__";

 static string Hash(Stream stream) {
  using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
 }
 static bool Ready(string root) {
  try {
   if (File.ReadAllText(Path.Combine(root, ".complete")) != PayloadHash) return false;
   foreach (var file in new[] {"MD-Assistant.exe", "icudtl.dat", "resources.pak", "resources/app/package.json", "resources/app/dist/desktop/main.js", "resources/app/dist/reader/owned/MD.MemoryHost.exe"})
    if (!File.Exists(Path.Combine(root, file))) return false;
   using (var icu = File.OpenRead(Path.Combine(root, "icudtl.dat"))) return Hash(icu) == IcuHash;
  } catch { return false; }
 }
 static string Extract() {
  var cache = Environment.GetEnvironmentVariable("MD_PORTABLE_CACHE");
  if (String.IsNullOrEmpty(cache)) cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "md-cannon-assistant", "portable");
  if (!Path.IsPathRooted(cache)) throw new IOException("Portable cache path must be absolute.");
  cache = Path.GetFullPath(cache);
  Directory.CreateDirectory(cache);
  var destination = Path.Combine(cache, PayloadHash);
  using (var gate = new Mutex(false, "Local\\MD_Assistant_" + PayloadHash)) {
   bool held;
   try { held = gate.WaitOne(120000); } catch (AbandonedMutexException) { held = true; }
   if (!held) throw new IOException("Another copy is preparing MD助手. Please try again shortly.");
   try {
    if (Ready(destination)) return destination;
    var staging = Path.Combine(cache, ".extract-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(staging);
    var prefix = Path.GetFullPath(staging) + Path.DirectorySeparatorChar;
    using (var payload = Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload.zip")) {
     if (payload == null || Hash(payload) != PayloadHash) throw new IOException("程序内置文件校验失败，请重新获取完整EXE。");
     payload.Position = 0;
     using (var zip = new ZipArchive(payload, ZipArchiveMode.Read)) {
      foreach (var entry in zip.Entries) {
       var name = entry.FullName.Replace('\\', '/');
       if (!name.StartsWith(PayloadRoot + "/", StringComparison.Ordinal)) throw new IOException("Invalid package root.");
       var relative = name.Substring(PayloadRoot.Length + 1);
       if (relative.Length == 0) continue;
       var target = Path.GetFullPath(Path.Combine(staging, relative.Replace('/', Path.DirectorySeparatorChar)));
       if (!target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || relative.IndexOf(':') >= 0) throw new IOException("Invalid package path.");
       if (name.EndsWith("/", StringComparison.Ordinal)) { Directory.CreateDirectory(target); continue; }
       Directory.CreateDirectory(Path.GetDirectoryName(target));
       using (var input = entry.Open()) using (var output = File.Create(target)) input.CopyTo(output);
      }
     }
    }
    File.WriteAllText(Path.Combine(staging, ".complete"), PayloadHash);
    if (!Ready(staging)) throw new IOException("程序运行文件校验失败，请重新获取完整EXE。");
    // Preserve a damaged/incomplete cache rather than removing running files.
    if (Directory.Exists(destination)) Directory.Move(destination, destination + ".old-" + Guid.NewGuid().ToString("N"));
    Directory.Move(staging, destination);
    return destination;
   } finally { gate.ReleaseMutex(); }
  }
 }
 static string Quote(string arg) {
  var text = new StringBuilder("\""); int slashes = 0;
  foreach (var ch in arg) {
   if (ch == '\\') { slashes++; continue; }
   if (ch == '"') { text.Append('\\', slashes * 2 + 1); text.Append(ch); }
   else { text.Append('\\', slashes); text.Append(ch); }
   slashes = 0;
  }
  text.Append('\\', slashes * 2); return text.Append('"').ToString();
 }
 [STAThread] static int Main(string[] args) {
  var extractOnly = args.Length == 1 && args[0] == "--extract-only";
  try {
   var root = Extract();
   if (extractOnly) { Console.WriteLine(root); return 0; }
   var quoted = new string[args.Length]; for (int i = 0; i < args.Length; i++) quoted[i] = Quote(args[i]);
   var start = new ProcessStartInfo(Path.Combine(root, "MD-Assistant.exe"), String.Join(" ", quoted)) {
    WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
    RedirectStandardOutput = true, RedirectStandardError = true
   };
   start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
   using (var child = new Process { StartInfo = start }) {
    child.OutputDataReceived += (sender, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
    child.ErrorDataReceived += (sender, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
    child.Start(); child.BeginOutputReadLine(); child.BeginErrorReadLine(); child.WaitForExit();
    return child.ExitCode;
   }
  } catch (Exception error) {
   Console.Error.WriteLine(error.Message);
   if (!extractOnly) MessageBox.Show("MD助手启动失败：\n" + error.Message, "MD助手", MessageBoxButtons.OK, MessageBoxIcon.Error);
   return 1;
  }
 }
}
