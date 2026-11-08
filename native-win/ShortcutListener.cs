using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

// Observe only the assigned Right Ctrl gesture. Other keys can invalidate a
// pending gesture, but their identity/content never leaves this callback.
// Never swallow input: normal Ctrl combinations continue working.
internal sealed class ShortcutListener : IDisposable {
  [StructLayout(LayoutKind.Sequential)] struct KEY { public uint Vk, Scan, Flags, Time; public UIntPtr Extra; }
  delegate IntPtr Hook(int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int id, Hook callback, IntPtr module, uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string module);
  readonly Thread thread;
  readonly Action<string> emit;
  readonly ManualResetEvent ready = new ManualResetEvent(false);
  Control dispatcher;
  IntPtr handle;
  Hook callback;
  bool held, interrupted;
  volatile bool disposed;
  public ShortcutListener(Action<string> emit) {
    this.emit=emit;
    thread=new Thread(Run) { IsBackground=true, Name="Seyvo assigned shortcut" };
    thread.SetApartmentState(ApartmentState.STA);
    thread.Start();
    if(!ready.WaitOne(3000) || handle==IntPtr.Zero) {
      Dispose();
      throw new InvalidOperationException("shortcut-unavailable");
    }
  }
  void Run() {
    using(var control=new Control()) {
      dispatcher=control;
      IntPtr window=control.Handle;
      // Reconfiguration/resume must require a fresh press, not a held key.
      held=GetAsyncKeyState(0xA3)<0; interrupted=held;
      callback=OnKey;
      handle=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
      ready.Set();
      if(handle==IntPtr.Zero)return;
      try { if(!disposed)Application.Run(); }
      finally { UnhookWindowsHookEx(handle); handle=IntPtr.Zero; }
    }
  }
  void Notify(string state) {
    // Keep the OS hook fast: pipe output runs later on its message loop.
    dispatcher.BeginInvoke(new Action(()=> { if(!disposed)emit(state); }));
  }
  IntPtr OnKey(int code,IntPtr message,IntPtr data) {
    if(code>=0) {
      var key=(KEY)Marshal.PtrToStructure(data,typeof(KEY));
      bool down=message.ToInt64()==0x100 || message.ToInt64()==0x104;
      bool up=message.ToInt64()==0x101 || message.ToInt64()==0x105;
      if(key.Vk==0xA3) {
        if(down && !held) {
          held=true; interrupted=false;
          foreach(int modifier in new int[] {0xA0,0xA1,0xA2,0xA4,0xA5,0x5B,0x5C})
            if(GetAsyncKeyState(modifier)<0)interrupted=true;
          if(!interrupted)Notify("down");
        } else if(up && held) { held=false; Notify("up"); }
      } else if(down && held && !interrupted) {
        interrupted=true; Notify("interrupted");
      }
    }
    return CallNextHookEx(handle,code,message,data);
  }
  public void Dispose() {
    disposed=true;
    if(dispatcher!=null && !dispatcher.IsDisposed && dispatcher.IsHandleCreated) {
      try { dispatcher.BeginInvoke(new Action(Application.ExitThread)); }
      catch(InvalidOperationException) { }
    }
    if(thread.IsAlive)thread.Join(3000);
    // If the callback thread is still winding down, leave its signal alive.
    if(!thread.IsAlive)ready.Dispose();
  }
}
