using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Security.Cryptography;
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
  [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
  [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format,IntPtr data);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClipboardFormatName(uint format,StringBuilder name,int size);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags,UIntPtr size);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr data);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr data);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr data);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr data);
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int Type,Width,Height,WidthBytes;public ushort Planes,BitsPixel;public IntPtr Bits; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAPINFO { public uint Size;public int Width,Height;public ushort Planes,BitCount;public uint Compression,SizeImage;public int XPels,YPels;public uint Used,Important,Colors; }
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr bitmap,int size,out BITMAP data);
  [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
  [DllImport("gdi32.dll")] static extern int GetDIBits(IntPtr dc,IntPtr bitmap,uint start,uint lines,byte[] bits,ref BITMAPINFO info,uint usage);
  const string OriginalTest="Seyvo synthetic original clipboard", ChangedTest="Seyvo synthetic concurrent clipboard change";
  static Dictionary<uint,string> imageDigests;
  static Dictionary<uint,string> textDigests;
  static Dictionary<uint,string> TextDigests(IntPtr owner) {
    if(!OpenClipboard(owner))return null;
    try {
      var result=new Dictionary<uint,string>();uint format=0;long total=0;
      while((format=EnumClipboardFormats(format))!=0) {
        var name=new StringBuilder(256);GetClipboardFormatName(format,name,256);
        string label=name.ToString();
        if(label=="DataObject" || label=="Ole Private Data")continue;
        if(format!=1 && format!=7 && format!=13 && format!=16 && label!="HTML Format" && label!="Rich Text Format" && label!="Chromium internal source URL" && label!="Chromium internal source RFH token" && label!="CanIncludeInClipboardHistory" && label!="CanUploadToCloudClipboard" && label!="ExcludeClipboardContentFromMonitorProcessing")return null;
        IntPtr data=GetClipboardData(format);long size=(long)GlobalSize(data).ToUInt64();total+=size;
        if(size<=0 || total>67108864)return null;
        IntPtr ptr=GlobalLock(data);if(ptr==IntPtr.Zero)return null;
        byte[] bytes=new byte[(int)size];
        try {Marshal.Copy(ptr,bytes,0,bytes.Length);using(var sha=SHA256.Create())result[format]=Convert.ToBase64String(sha.ComputeHash(bytes));}
        finally {Array.Clear(bytes,0,bytes.Length);GlobalUnlock(data);}
      }
      return result.ContainsKey(13)?result:null;
    } finally {CloseClipboard();}
  }
  static bool SameImage(Dictionary<uint,string> expected,Dictionary<uint,string> actual) {
    if(expected==null || actual==null)return false;
    if(expected.Count!=actual.Count)Console.Error.WriteLine("Image format count changed: "+expected.Count+" -> "+actual.Count);
    bool same=expected.Count==actual.Count;
    foreach(var pair in expected){string value;if(!actual.TryGetValue(pair.Key,out value)||value!=pair.Value){Console.Error.WriteLine("Image format changed: "+pair.Key);same=false;}}
    return same;
  }
  // Opt-in observation only: never backs up, seeds or replaces an occupied
  // clipboard. Only image payloads and Windows privacy flags are fingerprinted.
  static Dictionary<uint,string> ImageDigests(IntPtr owner) {
    if(!OpenClipboard(owner)) return null;
    try {
      var formats=new List<uint>();uint item=0;
      while((item=EnumClipboardFormats(item))!=0) formats.Add(item);
      if(!formats.Contains(8) && !formats.Contains(17)) {Console.Error.WriteLine("Clipboard has no portable image.");return null;}
      var result=new Dictionary<uint,string>();long total=0;
      foreach(uint format in formats) {
        if(format==2) {
          IntPtr bitmap=GetClipboardData(2);BITMAP dimensions;
          if(bitmap==IntPtr.Zero || GetObject(bitmap,Marshal.SizeOf(typeof(BITMAP)),out dimensions)==0){Console.Error.WriteLine("Clipboard bitmap is unavailable.");return null;}
          {
            int height=Math.Abs(dimensions.Height);
            long pixelBytes=(long)dimensions.Width*height*4;total+=pixelBytes;
            if(pixelBytes<=0 || total>67108864)return null;
            byte[] pixels=new byte[(int)pixelBytes];
            // Read clipboard HBITMAP through Win32: GDI+ cannot reliably wrap
            // every clipboard bitmap and may display a modal exception dialog.
            var info=new BITMAPINFO { Size=40,Width=dimensions.Width,Height=-height,Planes=1,BitCount=32 };
            IntPtr dc=CreateCompatibleDC(IntPtr.Zero);if(dc==IntPtr.Zero)return null;
            try {if(GetDIBits(dc,bitmap,0,(uint)height,pixels,ref info,0)!=height){Console.Error.WriteLine("Clipboard bitmap pixels are unavailable.");return null;}}
            finally {DeleteDC(dc);}
            for(int i=3;i<pixels.Length;i+=4)pixels[i]=255;
            using(var sha=SHA256.Create())result[2]=Convert.ToBase64String(sha.ComputeHash(pixels));
            Array.Clear(pixels,0,pixels.Length);
          }
          continue;
        }
        if(format==8 && formats.Contains(17)) continue;
        var name=new StringBuilder(256);GetClipboardFormatName(format,name,256);
        string label=name.ToString();
        if(label=="DataObject" || label=="Ole Private Data") continue;
        if(format!=8 && format!=17 && label!="PNG" && label!="System.Drawing.Bitmap" && label!="CanIncludeInClipboardHistory" && label!="CanUploadToCloudClipboard" && label!="ExcludeClipboardContentFromMonitorProcessing") return null;
        IntPtr data=GetClipboardData(format);long size=(long)GlobalSize(data).ToUInt64();total+=size;
        if(size<=0 || total>67108864) return null;
        IntPtr ptr=GlobalLock(data);if(ptr==IntPtr.Zero)return null;
        byte[] bytes=new byte[(int)size];
        try { Marshal.Copy(ptr,bytes,0,bytes.Length);using(var sha=SHA256.Create())result[format]=Convert.ToBase64String(sha.ComputeHash(bytes)); }
        finally { Array.Clear(bytes,0,bytes.Length);GlobalUnlock(data); }
      }
      return result;
    } finally {CloseClipboard();}
  }
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
    Button button=new Button { Text="Not a text field", Dock=DockStyle.Bottom }; form.Controls.Add(button);
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
          else if(command=="focused-state") {
            uint pid; GetWindowThreadProcessId(GetForegroundWindow(),out pid);
            string name; using(var process=System.Diagnostics.Process.GetProcessById((int)pid))name=process.ProcessName;
            Console.WriteLine(GetForegroundWindow()==form.Handle && box.Focused ? "field-focused" : "field-unfocused:"+name+":"+box.Focused);
          }
          else if(command=="clipboard-image-observe") {
            try {imageDigests=ImageDigests(form.Handle);Console.WriteLine(imageDigests==null?"image-unavailable":"image-observed");}
            catch {Console.WriteLine("image-observation-failed");}
          }
          else if(command=="clipboard-image-unchanged") {
            try {Console.WriteLine(SameImage(imageDigests,ImageDigests(form.Handle))?"image-unchanged":"image-mismatch");}
            catch {Console.WriteLine("image-observation-failed");}
          }
          else if(command=="clipboard-text-observe") {
            try {textDigests=TextDigests(form.Handle);Console.WriteLine(textDigests==null?"text-unavailable":"text-observed");}
            catch {Console.WriteLine("text-observation-failed");}
          }
          else if(command=="clipboard-text-unchanged") {
            try {Console.WriteLine(SameImage(textDigests,TextDigests(form.Handle))?"text-unchanged":"text-mismatch");}
            catch {Console.WriteLine("text-observation-failed");}
          }
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
          else if(command=="right-control-down" || command=="right-control-up") {
            bool up=command=="right-control-up";
            if(!up && GetForegroundWindow()!=form.Handle) { Console.WriteLine("focus-blocked"); return; }
            INPUT key=new INPUT { Type=1, Key=new KEYBDINPUT { Vk=0xA3, Flags=(uint)(up?3:1) } };
            Console.WriteLine(SendInput(1,new INPUT[] {key},Marshal.SizeOf(typeof(INPUT)))==1 ? "key-sent" : "input-blocked");
          }
          else if(command=="fn-fixture-down" || command=="fn-fixture-up") {
            bool up=command=="fn-fixture-up";
            if(!up && GetForegroundWindow()!=form.Handle) { Console.WriteLine("focus-blocked"); return; }
            INPUT key=new INPUT { Type=1,Key=new KEYBDINPUT { Vk=0x7C,Scan=0x64,Flags=(uint)(up?2:0) } };
            Console.WriteLine(SendInput(1,new INPUT[] {key},Marshal.SizeOf(typeof(INPUT)))==1?"key-sent":"input-blocked");
          }
          else if(command=="readonly") { box.ReadOnly=true; Console.WriteLine("readonly"); }
          else if(command=="button") { box.ReadOnly=false; button.BringToFront(); form.ActiveControl=button; button.Focus(); Console.WriteLine(button.Focused ? "button-focused" : "button-focus-blocked-"+button.CanFocus+"-"+button.Visible+"-"+button.Enabled); }
          else if(command=="quit") {
            INPUT release=new INPUT { Type=1, Key=new KEYBDINPUT { Vk=0xA3, Flags=3 } };
            INPUT fnRelease=new INPUT { Type=1, Key=new KEYBDINPUT { Vk=0x7C,Scan=0x64,Flags=2 } };
            SendInput(2,new INPUT[] {release,fnRelease},Marshal.SizeOf(typeof(INPUT)));
            form.Close();
          }
        }));
      }
    }); reader.IsBackground=true; reader.Start(); Application.Run(form);
  }
}
