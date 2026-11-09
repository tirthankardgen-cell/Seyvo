using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal sealed class FnBinding {
  public readonly int Vk, Scan;
  public readonly bool Extended;
  public static bool Allowed(int vk) { return (vk>=0x7C && vk<=0x87) || vk==0xE3 || vk==0xE4 || vk==0xE8 || vk==0xFF; }
  public FnBinding(int vk,int scan,bool extended) {
    if(!Allowed(vk) || scan<0 || scan>511)throw new InvalidOperationException("shortcut-unavailable");
    Vk=vk;Scan=scan;Extended=extended;
  }
  public static FnBinding Parse(object value) {
    var data=value as Dictionary<string,object>;
    if(data==null || data.Count!=3)throw new InvalidOperationException("shortcut-unavailable");
    return new FnBinding(Convert.ToInt32(data["vk"]),Convert.ToInt32(data["scan"]),Convert.ToBoolean(data["extended"]));
  }
}

// Bounded, explicitly requested calibration; ordinary key identities never
// leave the callback. Only non-typing function/OEM events can become a binding.
internal static class FnProbe {
  [StructLayout(LayoutKind.Sequential)] struct KEY { public uint Vk,Scan,Flags,Time; public UIntPtr Extra; }
  delegate IntPtr Hook(int code,IntPtr message,IntPtr data);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id,Hook callback,IntPtr module,uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string module);
  public static FnBinding Check(CancellationToken cancel) {
    FnBinding result=null;
    var worker=new Thread(()=> {
      FnBinding candidate=null;
      bool held=false,sampled=false;
      int pairs=0;
      DateTime downAt=DateTime.MinValue,end=DateTime.UtcNow.AddSeconds(12);
      IntPtr handle=IntPtr.Zero;
      Hook callback=(code,message,data)=> {
        if(code>=0) {
          var key=(KEY)Marshal.PtrToStructure(data,typeof(KEY));
          bool down=message.ToInt64()==0x100 || message.ToInt64()==0x104;
          bool up=message.ToInt64()==0x101 || message.ToInt64()==0x105;
          // Scripted input cannot pass the physical compatibility check.
          if((key.Flags&0x10)==0 && FnBinding.Allowed((int)key.Vk) && key.Scan<=511) {
            bool same=candidate!=null && key.Vk==candidate.Vk && key.Scan==candidate.Scan && ((key.Flags&1)!=0)==candidate.Extended;
            if(down && (!held || !same)) {
              if(!same)pairs=0;
              candidate=new FnBinding((int)key.Vk,(int)key.Scan,(key.Flags&1)!=0);
              held=true;sampled=false;downAt=DateTime.UtcNow;
            } else if(up && same && held) {
              held=false;
              if(sampled && (DateTime.UtcNow-downAt).TotalMilliseconds>=300) {
                if(++pairs==2) { result=candidate; Application.ExitThread(); }
              } else pairs=0;
            }
          } else if(down) { held=false;sampled=false;pairs=0;candidate=null; }
        }
        return CallNextHookEx(handle,code,message,data);
      };
      handle=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
      if(handle==IntPtr.Zero)return;
      using(var timer=new System.Windows.Forms.Timer { Interval=25 }) {
        timer.Tick+=(sender,args)=> {
          if(cancel.IsCancellationRequested || DateTime.UtcNow>=end) { result=null; Application.ExitThread(); }
          else if(held && candidate!=null && GetAsyncKeyState(candidate.Vk)<0)sampled=true;
        };
        timer.Start();
        try { Application.Run(); }
        finally { timer.Stop(); UnhookWindowsHookEx(handle); GC.KeepAlive(callback); }
      }
    }) { IsBackground=true,Name="Seyvo Fn compatibility check" };
    worker.SetApartmentState(ApartmentState.STA);worker.Start();worker.Join();
    return cancel.IsCancellationRequested?null:result;
  }
}
