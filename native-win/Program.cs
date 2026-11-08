using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Automation.Text;

// Private, bounded JSON-lines protocol on inherited pipes. No network, shell,
// clipboard reader command, text scraping or arbitrary HWND/key-listener API.
internal static class Program {
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int Type, Width, Height, WidthBytes; public ushort Planes, BitsPixel; public IntPtr Bits; }
  [StructLayout(LayoutKind.Sequential)] struct GUIINFO {
    public int Size, Flags; public IntPtr Active, Focus, Capture, MenuOwner, MoveSize, Caret; public RECT CaretRect;
  }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort Vk, Scan; public uint Flags, Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Explicit, Size=40)] struct INPUT { [FieldOffset(0)] public uint Type; [FieldOffset(8)] public KEYBDINPUT Key; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint thread, ref GUIINFO info);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int size);
  [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr h,int index);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window,ref POINT point);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr owner);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll")] static extern bool EmptyClipboard();
  [DllImport("user32.dll")] static extern uint EnumClipboardFormats(uint format);
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);
  [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format, IntPtr data);
  [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll")] static extern IntPtr GetClipboardOwner();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClipboardFormatName(uint format, StringBuilder name, int size);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern uint RegisterClipboardFormat(string name);
  [DllImport("user32.dll")] static extern IntPtr CopyImage(IntPtr source,uint type,int x,int y,uint flags);
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr handle,int size,out BITMAP bitmap);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr h);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags, UIntPtr size);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr h);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 220000 };
  static readonly Dictionary<string, Target> Targets = new Dictionary<string, Target>();
  static IntPtr clipboardOwner;
  static ShortcutListener shortcut;
  sealed class Target {
    public IntPtr Window, Focus;
    public uint Pid, Thread;
    public long Started;
    public string App, Runtime;
    public RECT Caret;
    public TextPatternRange Selection;
    public AutomationElement Element;
    public AutomationEventHandler SelectionListener;
    public volatile bool SelectionChanged;
    public bool InputAttempted;
  }
  static GUIINFO Gui(uint thread) {
    GUIINFO info = new GUIINFO(); info.Size = Marshal.SizeOf(typeof(GUIINFO));
    if (!GetGUIThreadInfo(thread, ref info)) throw new InvalidOperationException("target-unavailable");
    return info;
  }
  static string Identity(AutomationElement element) { return String.Join("-", element.GetRuntimeId()); }
  static AutomationElement SafeElement(uint pid) {
    AutomationElement element = AutomationElement.FocusedElement;
    if (element == null || element.Current.ProcessId != pid || element.Current.IsPassword || !element.Current.IsEnabled)
      throw new InvalidOperationException("unsafe-field");
    if (element.Current.ControlType != ControlType.Edit && element.Current.ControlType != ControlType.Document)
      throw new InvalidOperationException("choose-text-field");
    object pattern;
    if (element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) {
      if (((ValuePattern)pattern).Current.IsReadOnly) throw new InvalidOperationException("read-only-field");
    } else if (element.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) {
      object readOnly = ((TextPattern)pattern).DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
      if (!(readOnly is bool) || (bool)readOnly) throw new InvalidOperationException("read-only-field");
    } else throw new InvalidOperationException("choose-text-field");
    if (element.TryGetCurrentPattern(TextPattern.Pattern,out pattern)) {
      object readOnly=((TextPattern)pattern).DocumentRange.GetAttributeValue(TextPattern.IsReadOnlyAttribute);
      if(readOnly is bool && (bool)readOnly) throw new InvalidOperationException("read-only-field");
    }
    return element;
  }
  static void SafeNativeControl(IntPtr focus) {
    StringBuilder name=new StringBuilder(256); GetClassName(focus,name,name.Capacity);
    string kind=name.ToString();
    if(kind.Equals("Edit",StringComparison.OrdinalIgnoreCase) || kind.IndexOf(".EDIT.",StringComparison.OrdinalIgnoreCase)>=0 || kind.StartsWith("RichEdit",StringComparison.OrdinalIgnoreCase)) {
      long style=GetWindowLongPtr(focus,-16).ToInt64();
      if((style & 0x800)!=0) throw new InvalidOperationException("read-only-field");
      if((style & 0x20)!=0) throw new InvalidOperationException("unsafe-field");
    }
  }
  static TextPatternRange Selection(AutomationElement element) {
    object pattern;
    if (!element.TryGetCurrentPattern(TextPattern.Pattern, out pattern)) return null;
    TextPatternRange[] ranges = ((TextPattern)pattern).GetSelection();
    return ranges.Length == 1 ? ranges[0].Clone() : null;
  }
  static object ScreenCaret(GUIINFO gui, TextPatternRange selection) {
    if(gui.Caret!=IntPtr.Zero) {
      int width=gui.CaretRect.Right-gui.CaretRect.Left, height=gui.CaretRect.Bottom-gui.CaretRect.Top;
      POINT origin=new POINT { X=gui.CaretRect.Left, Y=gui.CaretRect.Top };
      if(width>=0 && width<=2000 && height>0 && height<=2000 && ClientToScreen(gui.Caret,ref origin))
        return new { x=origin.X, y=origin.Y, width=width, height=height };
    }
    // Geometry only: never call GetText. Some browser controls expose a narrow
    // selection rectangle even when they do not own a Win32 caret window.
    try {
      if(selection!=null) {
        var rectangles=selection.GetBoundingRectangles();
        if(rectangles.Length==1) {
          var rect=rectangles[0];
          if(!rect.IsEmpty && rect.Width>=0 && rect.Width<=8 && rect.Height>0 && rect.Height<=2000 &&
             !Double.IsInfinity(rect.X) && !Double.IsInfinity(rect.Y) && !Double.IsNaN(rect.X) && !Double.IsNaN(rect.Y))
            return new { x=(int)Math.Round(rect.X), y=(int)Math.Round(rect.Y), width=(int)Math.Ceiling(rect.Width), height=(int)Math.Ceiling(rect.Height) };
        }
      }
    } catch { }
    return null;
  }
  static void ClearTargets() {
    foreach(Target target in Targets.Values) {
      if(target.SelectionListener!=null) {
        try { Automation.RemoveAutomationEventHandler(TextPattern.TextSelectionChangedEvent,target.Element,target.SelectionListener); } catch { }
      }
    }
    Targets.Clear();
  }
  static object Capture(int ownPid, bool allowPractice) {
    IntPtr window = GetForegroundWindow(); uint pid; uint thread = GetWindowThreadProcessId(window, out pid);
    if (window == IntPtr.Zero || pid == ownPid && !allowPractice) throw new InvalidOperationException("choose-target");
    long started; string appName;
    using (Process process = Process.GetProcessById((int)pid)) {
      started=process.StartTime.ToFileTimeUtc(); appName=process.ProcessName + ".exe";
    }
    GUIINFO gui = Gui(thread); SafeNativeControl(gui.Focus); AutomationElement element = SafeElement(pid);
    if (pid == ownPid && (element.Current.Name != "Dictation practice" || element.Current.ControlType != ControlType.Edit)) throw new InvalidOperationException("choose-practice-field");
    Target target = new Target { Window=window, Focus=gui.Focus, Pid=pid, Thread=thread,
      Started=started, App=appName, Runtime=Identity(element),
      Caret=gui.CaretRect, Selection=Selection(element) };
    RECT bounds; if (!GetWindowRect(window, out bounds)) throw new InvalidOperationException("target-unavailable");
    ClearTargets();
    target.Element=element;
    target.SelectionListener=(sender,args)=> { target.SelectionChanged=true; };
    try { Automation.AddAutomationEventHandler(TextPattern.TextSelectionChangedEvent,element,TreeScope.Element,target.SelectionListener); }
    catch { target.SelectionListener=null; }
    string token = Guid.NewGuid().ToString("N"); Targets[token] = target;
    return new { token=token, app=target.App, x=bounds.Left, y=bounds.Top, width=bounds.Right-bounds.Left, height=bounds.Bottom-bounds.Top, caret=ScreenCaret(gui,target.Selection) };
  }
  static void Verify(Target target) {
    if(target.InputAttempted) throw new InvalidOperationException("input-already-attempted");
    uint pid;
    if (!IsWindow(target.Window) || GetForegroundWindow() != target.Window ||
      GetWindowThreadProcessId(target.Window, out pid) != target.Thread || pid != target.Pid ||
      ProcessStarted(pid) != target.Started)
      throw new InvalidOperationException("target-changed");
    GUIINFO gui = Gui(target.Thread);
    SafeNativeControl(gui.Focus);
    if (gui.Focus != target.Focus) throw new InvalidOperationException("field-changed");
    if (target.SelectionChanged || gui.CaretRect.Left != target.Caret.Left || gui.CaretRect.Top != target.Caret.Top)
      throw new InvalidOperationException("caret-changed");
    AutomationElement element = SafeElement(pid);
    if (Identity(element) != target.Runtime) throw new InvalidOperationException("field-changed");
    if (target.Selection != null) {
      TextPatternRange current = Selection(element);
      if (current == null || current.CompareEndpoints(TextPatternRangeEndpoint.Start, target.Selection, TextPatternRangeEndpoint.Start) != 0 ||
        current.CompareEndpoints(TextPatternRangeEndpoint.End, target.Selection, TextPatternRangeEndpoint.End) != 0)
        throw new InvalidOperationException("caret-changed");
    }
  }
  static long ProcessStarted(uint pid) {
    using(Process process=Process.GetProcessById((int)pid)) return process.StartTime.ToFileTimeUtc();
  }
  static bool ModifiersDown() {
    foreach(int key in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C }) if (GetAsyncKeyState(key) < 0) return true;
    return false;
  }
  static void WaitModifiers() {
    Stopwatch timer = Stopwatch.StartNew();
    while (ModifiersDown()) { if (timer.ElapsedMilliseconds > 1500) throw new InvalidOperationException("release-modifiers"); Thread.Sleep(10); }
  }
  static INPUT Key(ushort vk, ushort scan, uint flags) { return new INPUT { Type=1, Key=new KEYBDINPUT { Vk=vk, Scan=scan, Flags=flags } }; }
  static void Send(INPUT[] inputs) {
    if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length)
      throw new InvalidOperationException("input-blocked");
  }
  static void Open() {
    for (int i=0; i<20; i++) { if (OpenClipboard(clipboardOwner)) return; Thread.Sleep(10); }
    throw new InvalidOperationException("clipboard-busy");
  }
  static string FormatName(uint format) {
    StringBuilder name = new StringBuilder(256); GetClipboardFormatName(format, name, name.Capacity);
    return name.ToString();
  }
  static bool Supported(uint format, string name) {
    if (format == 1 || format == 7 || format == 8 || format == 13 || format == 16 || format == 17) return true;
    return name == "HTML Format" || name == "Rich Text Format" || name == "PNG" || name == "System.Drawing.Bitmap" ||
      name == "Chromium internal source URL" || name == "Chromium internal source RFH token" ||
      name == "CanIncludeInClipboardHistory" || name == "CanUploadToCloudClipboard" ||
      name == "ExcludeClipboardContentFromMonitorProcessing";
  }
  sealed class ClipboardSnapshot : IDisposable {
    public readonly Dictionary<uint,byte[]> Data=new Dictionary<uint,byte[]>();
    public IntPtr Bitmap;
    public void Restore() {
      foreach(var item in Data) Put(item.Key,item.Value);
      // Keep the original GDI rendering as well as the portable DIB/PNG data.
      // Windows may color-convert a bitmap synthesized from DIBV5.
      if(Bitmap!=IntPtr.Zero) {
        if(SetClipboardData(2,Bitmap)==IntPtr.Zero) throw new InvalidOperationException("clipboard-write");
        Bitmap=IntPtr.Zero; // Ownership transferred to Windows exactly once.
      }
    }
    public void Dispose() {
      if(Bitmap!=IntPtr.Zero){DeleteObject(Bitmap);Bitmap=IntPtr.Zero;}
      foreach(byte[] bytes in Data.Values)Array.Clear(bytes,0,bytes.Length);
      Data.Clear();
    }
  }
  static ClipboardSnapshot Snapshot() {
    ClipboardSnapshot snapshot=new ClipboardSnapshot();uint format=0;long total=0;
    var data=snapshot.Data;
    List<uint> formats=new List<uint>();
    while ((format=EnumClipboardFormats(format)) != 0) formats.Add(format);
    bool dibV5=formats.Contains(17), content=false, ole=false;
    try {
      foreach(uint item in formats) {
        if(item==2) {
          IntPtr source=GetClipboardData(2);BITMAP bitmap;
          if(source==IntPtr.Zero || GetObject(source,Marshal.SizeOf(typeof(BITMAP)),out bitmap)==0)
            throw new InvalidOperationException("clipboard-unavailable");
          long bitmapBytes=Math.Abs((long)bitmap.Height)*Math.Abs((long)bitmap.WidthBytes);total+=bitmapBytes;
          if(bitmapBytes<=0 || total>67108864)throw new InvalidOperationException("clipboard-too-large");
          snapshot.Bitmap=CopyImage(source,0,0,0,0);
          if(snapshot.Bitmap==IntPtr.Zero)throw new InvalidOperationException("clipboard-unavailable");
          content=true;continue;
        }
        // DIBV5 retains the full portable image; Windows can synthesize DIB.
        if(item==8 && dibV5)continue;
        string name=FormatName(item);
        // These identify the previous COM clipboard owner, not transferable
        // content. Replaying its pointers after ownership changes is unsafe.
        // Every concrete payload must still be supported and materialized.
        if(name=="DataObject" || name=="Ole Private Data") { ole=true; continue; }
        if (!Supported(item,name)) throw new InvalidOperationException("clipboard-format-unsupported");
        IntPtr handle=GetClipboardData(item); long size=(long)GlobalSize(handle).ToUInt64(); total+=size;
        if (size <= 0 || total > 67108864) throw new InvalidOperationException("clipboard-too-large");
        IntPtr ptr=GlobalLock(handle); if (ptr == IntPtr.Zero) throw new InvalidOperationException("clipboard-unavailable");
        try { byte[] bytes=new byte[(int)size]; Marshal.Copy(ptr, bytes, 0, bytes.Length); data[item]=bytes; }
        finally { GlobalUnlock(handle); }
        if(item<0xC000 || name=="PNG" || name=="HTML Format" || name=="Rich Text Format") content=true;
      }
      if(ole && !content) throw new InvalidOperationException("clipboard-format-unsupported");
      return snapshot;
    } catch {
      snapshot.Dispose();
      throw;
    }
  }
  static void Put(uint format, byte[] bytes) {
    IntPtr handle=GlobalAlloc(0x0042, (UIntPtr)bytes.Length);
    if (handle == IntPtr.Zero) throw new InvalidOperationException("clipboard-allocation");
    bool transferred=false;
    try {
      IntPtr ptr=GlobalLock(handle); if (ptr==IntPtr.Zero) throw new InvalidOperationException("clipboard-allocation");
      try { Marshal.Copy(bytes, 0, ptr, bytes.Length); } finally { GlobalUnlock(handle); }
      if (SetClipboardData(format, handle)==IntPtr.Zero) throw new InvalidOperationException("clipboard-write");
      transferred=true;
    } finally { if (!transferred) GlobalFree(handle); }
  }
  static object Insert(string token, string text, string method) {
    if (text.Length == 0 || text.Length > 100000 || text.IndexOf('\0') >= 0) throw new InvalidOperationException("invalid-text");
    Target target; if (!Targets.TryGetValue(token, out target)) throw new InvalidOperationException("target-expired");
    WaitModifiers(); Verify(target);
    if (method == "unicode") {
      // CR/LF as virtual keys could submit in chat fields. Refuse multiline here.
      if (text.IndexOfAny(new char[] {'\r','\n'}) >= 0 || text.Length > 5000) throw new InvalidOperationException("use-clipboard-mode");
      // The current Windows 11 Notepad transformed the Unicode fixture in real
      // acceptance. Refuse this known-incompatible path before any keystrokes;
      // keep the transcript for recovery rather than changing keyboard settings.
      if(target.App.Equals("notepad.exe",StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("notepad-use-clipboard");
      List<INPUT> inputs=new List<INPUT>();
      foreach(char c in text) { inputs.Add(Key(0,c,4)); inputs.Add(Key(0,c,6)); }
      Verify(target); target.InputAttempted=true; Send(inputs.ToArray());
      return new { attempted=true, restored=true, message="Insertion may have failed. Check the target before retrying." };
    }
    ClipboardSnapshot original=null; uint ours=0; bool restored=false;
    Open();
    try {
      original=Snapshot(); Verify(target);
      if (!EmptyClipboard()) throw new InvalidOperationException("clipboard-busy");
      try {
        // Tell Windows not to put the temporary transcript in clipboard history
        // or cloud sync. Other clipboard readers may still observe it.
        foreach(string name in new string[] { "CanIncludeInClipboardHistory", "CanUploadToCloudClipboard" }) {
          uint flag=RegisterClipboardFormat(name);
          if(flag==0) throw new InvalidOperationException("clipboard-write");
          Put(flag,BitConverter.GetBytes(0));
        }
        Put(13, Encoding.Unicode.GetBytes(text.Replace("\r\n", "\n").Replace("\n", "\r\n")+"\0"));
      }
      catch { EmptyClipboard(); original.Restore(); throw; }
    } catch {
      if(original!=null)original.Dispose();
      throw;
    } finally { CloseClipboard(); }
    try {
      // Windows can advance the sequence when CloseClipboard publishes formats.
      // Sample afterward, then verify ownership so another writer is never
      // mistaken for our transaction or overwritten during restoration.
      ours=GetClipboardSequenceNumber();
      if(GetClipboardOwner()!=clipboardOwner) { ours=0; throw new InvalidOperationException("clipboard-changed"); }
      Verify(target); if (ModifiersDown()) throw new InvalidOperationException("release-modifiers");
      if (GetClipboardSequenceNumber()!=ours || GetClipboardOwner()!=clipboardOwner) throw new InvalidOperationException("clipboard-changed");
      target.InputAttempted=true;
      Send(new INPUT[] {Key(0x11,0,0),Key(0x56,0,0),Key(0x56,0,2),Key(0x11,0,2)});
      Thread.Sleep(800);
    } finally {
      try {
        Open();
        try { if (ours!=0 && GetClipboardSequenceNumber()==ours && GetClipboardOwner()==clipboardOwner) { EmptyClipboard(); original.Restore(); restored=true; } }
        finally { CloseClipboard(); }
      } finally { original.Dispose(); }
    }
    return new { attempted=true, restored=restored, message="Insertion may have failed. Check the target before retrying." };
  }
  [MTAThread] static void Main() {
    Console.InputEncoding=Encoding.UTF8; Console.OutputEncoding=new UTF8Encoding(false);
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    using (System.Windows.Forms.Form owner=new System.Windows.Forms.Form()) {
      clipboardOwner=owner.Handle;
      string line;
      while ((line=Console.ReadLine()) != null) {
        int id=0;
        try {
          if (line.Length > 220000) throw new InvalidOperationException("request-too-large");
          var request=Json.Deserialize<Dictionary<string,object>>(line); id=Convert.ToInt32(request["id"]);
          string command=Convert.ToString(request["command"]); object result;
          if (command=="ping") result=new { version=1, architecture="x64" };
          else if (command=="watchShortcut") {
            if(shortcut!=null) { shortcut.Dispose(); shortcut=null; }
            int generation=Convert.ToInt32(request["generation"]);
            if(generation<1)throw new InvalidOperationException("shortcut-unavailable");
            if(Convert.ToBoolean(request["enabled"]))
              shortcut=new ShortcutListener(state=>Console.WriteLine("{\"event\":\"shortcut\",\"generation\":"+generation+",\"state\":\""+state+"\"}"));
            result=new { watching=shortcut!=null };
          }
          else if (command=="cue") { CuePlayer.Play(Convert.ToString(request["cue"])); result=new { played=true }; }
          else if (command=="capture") result=Capture(Convert.ToInt32(request["ownPid"]),request.ContainsKey("allowPractice") && Convert.ToBoolean(request["allowPractice"]));
          else if (command=="insert") result=Insert(Convert.ToString(request["token"]),Convert.ToString(request["text"]),Convert.ToString(request["method"]));
          else if (command=="clear") { ClearTargets(); result=new { cleared=true }; }
          else throw new InvalidOperationException("unknown-command");
          Console.WriteLine(Json.Serialize(new { id=id, ok=true, result=result }));
        } catch (Exception e) {
          // Only our own fixed error codes cross the process boundary.
          string code=e is InvalidOperationException && e.Message.Length<60 && e.Message.IndexOf(' ')<0 ? e.Message : "native-operation-failed";
          Console.WriteLine(Json.Serialize(new { id=id, ok=false, error=code }));
        }
      }
      ClearTargets();
      if(shortcut!=null)shortcut.Dispose();
      CuePlayer.Close();
    }
  }
}
