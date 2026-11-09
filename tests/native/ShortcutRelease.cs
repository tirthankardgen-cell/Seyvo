using System;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;

// Compile alongside the production listener. Removing its hook reproduces a
// lost callback while Windows still updates the physical/logical key state.
// No test command or reflection path is included in the shipped helper.
internal static class ShortcutRelease {
  [StructLayout(LayoutKind.Sequential)] struct KEY { public ushort Vk,Scan; public uint Flags,Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Explicit,Size=40)] struct INPUT { [FieldOffset(0)] public uint Type; [FieldOffset(8)] public KEY Key; }
  [DllImport("user32.dll")] static extern uint SendInput(uint count,INPUT[] inputs,int size);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr handle);
  static void Key(bool up) {
    var input=new INPUT { Type=1,Key=new KEY { Vk=0xA3,Flags=(uint)(up?3:1) } };
    if(SendInput(1,new INPUT[] {input},40)!=1)throw new Exception("input-blocked");
  }
  static int Main() {
    int downs=0,ups=0;
    try {
      Key(true);
      using(var listener=new ShortcutListener(state=> {
        if(state=="down")Interlocked.Increment(ref downs);
        if(state=="up")Interlocked.Increment(ref ups);
      })) {
        Key(false);
        if(!SpinWait.SpinUntil(()=>Volatile.Read(ref downs)==1,1000))throw new Exception("missing-down");
        var field=typeof(ShortcutListener).GetField("handle",BindingFlags.Instance|BindingFlags.NonPublic);
        if(!UnhookWindowsHookEx((IntPtr)field.GetValue(listener)))throw new Exception("unhook-failed");
        Key(true);
        if(!SpinWait.SpinUntil(()=>Volatile.Read(ref ups)==1,1000))throw new Exception("release-not-recovered");
        Thread.Sleep(100);
        if(Volatile.Read(ref ups)!=1)throw new Exception("duplicate-release");
        Key(false);
        Thread.Sleep(150);
        if(Volatile.Read(ref downs)!=1)throw new Exception("poll-invented-activation");
        Key(true);
      }
      Console.WriteLine("Lost release recovered once; polling never activates.");
      return 0;
    } catch(Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    finally { Key(true); }
  }
}
