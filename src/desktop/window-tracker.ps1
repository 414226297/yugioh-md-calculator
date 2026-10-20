$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class MDWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; }
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h,ref POINT p);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; public uint extra; }
 private delegate IntPtr MouseProc(int code,IntPtr message,IntPtr data);
 private static MouseProc callback = OnMouse;
 private static IntPtr hook;
 public static long Click; public static int ClickX,ClickY;
 [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int id,MouseProc proc,IntPtr module,uint thread);
 [DllImport("kernel32.dll",CharSet=CharSet.Auto)] private static extern IntPtr GetModuleHandle(string name);
 [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
 [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
 [DllImport("user32.dll")] private static extern bool PeekMessage(out MSG msg,IntPtr hwnd,uint min,uint max,uint remove);
 [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
 private static IntPtr OnMouse(int code,IntPtr message,IntPtr data) {
  if(code>=0 && (message.ToInt64()==0x201 || message.ToInt64()==0x204)) {
   POINT point=(POINT)Marshal.PtrToStructure(data,typeof(POINT));ClickX=point.X;ClickY=point.Y;Click++;
  }
  return CallNextHookEx(hook,code,message,data);
 }
 public static void StartMouse(){hook=SetWindowsHookEx(14,callback,GetModuleHandle(null),0);}
 public static void StopMouse(){if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);}
 public static void Pump(){MSG msg;while(PeekMessage(out msg,IntPtr.Zero,0,0,1))DispatchMessage(ref msg);}
}
"@
try { [void][MDWindow]::SetThreadDpiAwarenessContext([IntPtr]::new(-4)) } catch {}
[MDWindow]::StartMouse()
try {
while ($true) {
 try {
  $handle = [MDWindow]::GetForegroundWindow()
  [uint32]$gameProcessId = 0
  [void][MDWindow]::GetWindowThreadProcessId($handle,[ref]$gameProcessId)
  $process = Get-Process -Id $gameProcessId -ErrorAction Stop
  $active = $process.ProcessName -eq 'masterduel' -and [MDWindow]::IsWindowVisible($handle) -and -not [MDWindow]::IsIconic($handle)
  if ($active) {
   $rect = [MDWindow+RECT]::new(); $point = [MDWindow+POINT]::new()
   if (-not [MDWindow]::GetClientRect($handle,[ref]$rect) -or -not [MDWindow]::ClientToScreen($handle,[ref]$point)) { throw 'window unavailable' }
   [Console]::WriteLine(('{"active":true,"pid":'+$gameProcessId+',"x":'+$point.X+',"y":'+$point.Y+',"width":'+($rect.Right-$rect.Left)+',"height":'+($rect.Bottom-$rect.Top)+',"click":'+[MDWindow]::Click+',"clickX":'+[MDWindow]::ClickX+',"clickY":'+[MDWindow]::ClickY+'}'))
  } else { [Console]::WriteLine('{"active":false}') }
 } catch { [Console]::WriteLine('{"active":false}') }
 for($tick=0;$tick -lt 10;$tick++){[MDWindow]::Pump();Start-Sleep -Milliseconds 10}
}
} finally { [MDWindow]::StopMouse() }
