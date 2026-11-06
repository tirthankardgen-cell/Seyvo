using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Windows.Forms;
// Disposable, visibly labelled test control. Reads only its own synthetic content.
class TestHost {
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint source,uint target,bool attach);
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort Vk, Scan; public uint Flags, Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Explicit, Size=40)] struct INPUT { [FieldOffset(0)] public uint Type; [FieldOffset(8)] public KEYBDINPUT Key; }
  [DllImport("user32.dll")] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll")] static extern bool EmptyClipboard();
  [DllImport("user32.dll")] static extern uint EnumClipboardFormats(uint previous);
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
  [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format,IntPtr data);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags,UIntPtr size);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr data);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr data);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr data);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr data);
  const string OriginalTest="Seyvo synthetic original clipboard", ChangedTest="Seyvo synthetic concurrent clipboard change";
  static string SmallClipboardText() {
    IntPtr data=GetClipboardData(13);
    if(data==IntPtr.Zero || GlobalSize(data).ToUInt64()>512) return null;
    IntPtr locked=GlobalLock(data); if(locked==IntPtr.Zero) return null;
    try { return Marshal.PtrToStringUni(locked); } finally { GlobalUnlock(data); }
  }
  static bool SetSynthetic(IntPtr owner,string text,string expected) {
    if(!OpenClipboard(owner)) return false;
    try {
      if(expected==null ? EnumClipboardFormats(0)!=0 : SmallClipboardText()!=expected) return false;
      byte[] bytes=Encoding.Unicode.GetBytes(text+"\0");
      IntPtr data=GlobalAlloc(0x42,(UIntPtr)bytes.Length);
      if(data==IntPtr.Zero) return false;
      IntPtr locked=GlobalLock(data);
      if(locked==IntPtr.Zero) { GlobalFree(data); return false; }
      Marshal.Copy(bytes,0,locked,bytes.Length); GlobalUnlock(data);
      if(!EmptyClipboard() || SetClipboardData(13,data)==IntPtr.Zero) { GlobalFree(data); return false; }
      return true;
    } finally { CloseClipboard(); }
  }
  [STAThread] static void Main() {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    Console.OutputEncoding=new UTF8Encoding(false); Console.InputEncoding=Encoding.UTF8;
    Form form=new Form { Text="Seyvo isolated insertion test", Width=600, Height=300, TopMost=true };
    TextBox box=new TextBox { Multiline=true, Dock=DockStyle.Fill, AccessibleName="Seyvo synthetic insertion target" }; form.Controls.Add(box);
    bool clipboardSaved=false, raceOnPaste=false;
    Func<bool> restoreClipboard=()=> {
      if(!clipboardSaved) return true;
      if(!OpenClipboard(form.Handle)) return false;
      try {
        string current=SmallClipboardText();
        if(current==OriginalTest || current==ChangedTest) {
          if(!EmptyClipboard()) return false;
        }
        clipboardSaved=false; return true;
      } finally { CloseClipboard(); }
    };
    form.FormClosing+=(sender,args)=> { restoreClipboard(); };
    box.TextChanged+=(sender,args)=> {
      if(raceOnPaste && box.Text.Length>0) {
        raceOnPaste=false;
        // TextBox still holds the clipboard during TextChanged. Mutate on the
        // next UI message, after the paste has released its clipboard lock.
        form.BeginInvoke(new Action(()=>SetSynthetic(form.Handle,ChangedTest,"Synthetic race test")));
      }
    };
    form.Shown+=(sender,args)=> { box.Focus(); Console.WriteLine("ready"); };
    Thread reader=new Thread(()=> {
      string line;
      while ((line=Console.ReadLine())!=null) {
        string command=line;
        form.BeginInvoke(new Action(()=> {
          if(command=="focus") {
            uint pid; uint foreground=GetWindowThreadProcessId(GetForegroundWindow(),out pid); uint thread=GetCurrentThreadId();
            bool attached=foreground!=thread && AttachThreadInput(thread,foreground,true);
            try { SetForegroundWindow(form.Handle); form.Activate(); box.Focus(); }
            finally { if(attached) AttachThreadInput(thread,foreground,false); }
            Console.WriteLine(GetForegroundWindow()==form.Handle ? "focused" : "focus-blocked");
          }
          else if(command=="text") Console.WriteLine(Convert.ToBase64String(Encoding.UTF8.GetBytes(box.Text)));
          else if(command=="clear") { box.ReadOnly=false; box.Clear(); box.Focus(); Console.WriteLine("cleared"); }
          else if(command=="clipboard-test") {
            if(!SetSynthetic(form.Handle,OriginalTest,null)) { Console.WriteLine("clipboard-not-empty"); return; }
            clipboardSaved=true;
            Console.WriteLine("clipboard-prepared");
          }
          else if(command=="clipboard-original") Console.WriteLine(Clipboard.GetText()=="Seyvo synthetic original clipboard" ? "clipboard-preserved" : "clipboard-mismatch");
          else if(command=="clipboard-race") { raceOnPaste=true; Console.WriteLine("race-armed"); }
          else if(command=="clipboard-changed") Console.WriteLine(Clipboard.GetText()=="Seyvo synthetic concurrent clipboard change" ? "new-clipboard-preserved" : "clipboard-mismatch");
          else if(command=="clipboard-restore") Console.WriteLine(restoreClipboard() ? "clipboard-restored" : "clipboard-restore-failed");
          else if(command=="shortcut") {
            if(GetForegroundWindow()!=form.Handle) { Console.WriteLine("focus-blocked"); return; }
            INPUT down=new INPUT { Type=1, Key=new KEYBDINPUT { Vk=0x77 } };
            INPUT up=new INPUT { Type=1, Key=new KEYBDINPUT { Vk=0x77, Flags=2 } };
            Console.WriteLine(SendInput(2,new INPUT[] { down,up },Marshal.SizeOf(typeof(INPUT)))==2 ? "shortcut-sent" : "input-blocked");
          }
          else if(command=="readonly") { box.ReadOnly=true; Console.WriteLine("readonly"); }
          else if(command=="quit") form.Close();
        }));
      }
    }); reader.IsBackground=true; reader.Start(); Application.Run(form);
  }
}
