// Copyright (c) 2026 璀璨星空. MIT. Original read-only Windows transport.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;

internal static class MemoryHost {
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process, IntPtr address, byte[] buffer, UIntPtr length, out UIntPtr read);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=3000000 };
 static IntPtr Handle;
 static Process Target;
 static byte[] Read(long address,int length) {
  if(address<65536 || address>0x00007fffffffffffL || length<1 || length>1048576 || address>0x00007fffffffffffL-length)throw new ArgumentException("Invalid read bounds");
  byte[] bytes=new byte[length];UIntPtr read;
  if(!ReadProcessMemory(Handle,new IntPtr(address),bytes,new UIntPtr((uint)length),out read)||read.ToUInt64()!=(ulong)length)throw new InvalidOperationException("ReadProcessMemory failed: "+Marshal.GetLastWin32Error());
  return bytes;
 }
 static object Execute(Dictionary<string,object> request) {
  string op=Convert.ToString(request["op"]);
  if(Target.HasExited)throw new InvalidOperationException("Target exited");
  if(op=="read")return Convert.ToBase64String(Read(long.Parse(Convert.ToString(request["address"])),Convert.ToInt32(request["length"])));
  if(op=="readMany") {
   var results=new List<string>();int total=0;
   foreach(object item in (System.Collections.IEnumerable)request["ranges"]) {
    var range=(Dictionary<string,object>)item;int length=Convert.ToInt32(range["length"]);
    if(results.Count>=128||length<1||length>1048576-total)throw new ArgumentException("Batch read limit");total+=length;
    results.Add(Convert.ToBase64String(Read(long.Parse(Convert.ToString(range["address"])),length)));
   }
   return results;
  }
  if(op=="modules") {
   var modules=new List<object>();Target.Refresh();
   foreach(ProcessModule module in Target.Modules)modules.Add(new {name=module.ModuleName,address=module.BaseAddress.ToInt64().ToString(),size=module.ModuleMemorySize,path=module.FileName});
   return modules;
  }
  throw new ArgumentException("Unsupported operation");
 }
 public static int Main(string[] args) {
  IntPtr sample=IntPtr.Zero;
  try {
   bool self=args.Length==1&&args[0]=="--self-test";
   int pid=self?Process.GetCurrentProcess().Id:int.Parse(args[0]);
   Target=Process.GetProcessById(pid);
   if(!self&&!String.Equals(Target.ProcessName,"masterduel",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("Expected masterduel process");
   // PROCESS_VM_READ | PROCESS_QUERY_INFORMATION. No write/operation/thread rights.
   Handle=OpenProcess(0x0010|0x0400,false,pid);
   if(Handle==IntPtr.Zero)throw new InvalidOperationException("OpenProcess failed: "+Marshal.GetLastWin32Error());
   if(self){sample=Marshal.AllocHGlobal(16);Marshal.Copy(new byte[]{77,68,65,83,83,73,83,84,65,78,84,0,1,2,3,4},0,sample,16);}
   Console.WriteLine(Json.Serialize(new {ready=true,pid=pid,protocol=1,fixture=self?sample.ToInt64().ToString():null}));
   string line;
   while((line=Console.ReadLine())!=null) {
    object id=null;
    try {
     if(line.Length>32768)throw new ArgumentException("Request too large");
     var request=Json.Deserialize<Dictionary<string,object>>(line);id=request["id"];
     Console.WriteLine(Json.Serialize(new {id=id,ok=true,result=Execute(request)}));
    }catch(Exception ex){Console.WriteLine(Json.Serialize(new {id=id,ok=false,error=ex.Message}));}
   }
   return 0;
  }catch(Exception ex){Console.Error.WriteLine(ex.Message);return 1;}
  finally {if(sample!=IntPtr.Zero)Marshal.FreeHGlobal(sample);if(Handle!=IntPtr.Zero)CloseHandle(Handle);if(Target!=null)Target.Dispose();}
 }
}
