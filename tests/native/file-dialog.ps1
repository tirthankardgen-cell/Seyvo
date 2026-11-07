param(
  [Parameter(Mandatory=$true)][int]$AppProcessId,
  [ValidateSet('open','save','cancel')][string]$Action,
  [string]$FixtureRoot,
  [string]$FilePath
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class SeyvoFileDialog {
  public delegate bool EnumProc(IntPtr h,IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,EnumProc callback,IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
  [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent,IntPtr child);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr h,int id);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int count);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h,uint message,IntPtr wparam,string text,uint flags,uint timeout,out UIntPtr result);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h,uint message,IntPtr wparam,IntPtr data,uint flags,uint timeout,out UIntPtr result);
  public static IntPtr FilenameField(IntPtr dialog,uint expectedPid) {
    IntPtr found=IntPtr.Zero; int count=0;
    EnumChildWindows(dialog,(h,p)=>{
      uint pid;GetWindowThreadProcessId(h,out pid);
      var name=new StringBuilder(64);GetClassName(h,name,64);
      int id=GetDlgCtrlID(h);
      if(pid==expectedPid && name.ToString()=="Edit" && (id==1001 || id==1148)) {found=h;count++;}
      return true;
    },IntPtr.Zero);
    return count==1?found:IntPtr.Zero;
  }
  public static bool SetFilename(IntPtr dialog,IntPtr field,uint expectedPid,string text) {
    uint pid; GetWindowThreadProcessId(field,out pid);
    var name=new StringBuilder(32); GetClassName(field,name,32);
    if(pid!=expectedPid || !IsChild(dialog,field) || (GetDlgCtrlID(field)!=1001 && GetDlgCtrlID(field)!=1148) || name.ToString()!="Edit") return false;
    UIntPtr result;
    return SendMessageTimeout(field,0x000C,IntPtr.Zero,text,2,2000,out result)!=IntPtr.Zero && result!=UIntPtr.Zero;
  }
  public static bool ClickAction(IntPtr dialog,uint expectedPid,int id) {
    if(id!=1 && id!=2) return false;
    IntPtr button=GetDlgItem(dialog,id); uint pid; GetWindowThreadProcessId(button,out pid);
    var name=new StringBuilder(32); GetClassName(button,name,32);
    if(pid!=expectedPid || !IsChild(dialog,button) || name.ToString()!="Button") return false;
    UIntPtr result;
    return SendMessageTimeout(button,0x00F5,IntPtr.Zero,IntPtr.Zero,2,2000,out result)!=IntPtr.Zero;
  }
}
'@
if($Action -ne 'cancel') {
  $rootPath=[IO.Path]::GetFullPath($FixtureRoot).TrimEnd('\')+'\'
  $filePathResolved=[IO.Path]::GetFullPath($FilePath)
  if(-not $filePathResolved.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'File-dialog destination is outside the owned fixture directory.'
  }
}
$owned=Get-Process -Id $AppProcessId -ErrorAction Stop
if($owned.ProcessName -ne 'Seyvo') {throw 'Expected installed test process is unavailable.'}
$processCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppProcessId)
$deadline=[DateTime]::UtcNow.AddSeconds(10)
$dialogs=@()
do {
  $dialogs=@([System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$processCondition) | Where-Object {$_.Current.ClassName -eq '#32770' -and -not $_.Current.IsOffscreen})
  if($dialogs.Count -eq 1) {break}
  Start-Sleep -Milliseconds 100
} while([DateTime]::UtcNow -lt $deadline)
if($dialogs.Count -ne 1) {throw 'Owned file dialog is not uniquely identified.'}
$dialog=$dialogs[0]
if($Action -ne 'cancel') {
  # Some Windows common-dialog controls expose only UIA panes. Use their narrow
  # native Edit IDs inside the uniquely owned dialog; never type into foreground.
  $fieldDeadline=[DateTime]::UtcNow.AddSeconds(8)
  do {
    $field=[SeyvoFileDialog]::FilenameField([IntPtr]$dialog.Current.NativeWindowHandle,$AppProcessId)
    if($field -ne [IntPtr]::Zero) {break}
    Start-Sleep -Milliseconds 100
  } while([DateTime]::UtcNow -lt $fieldDeadline)
  if($field -eq [IntPtr]::Zero) {throw 'Owned dialog filename field is not uniquely identified.'}
  if(-not [SeyvoFileDialog]::SetFilename([IntPtr]$dialog.Current.NativeWindowHandle,$field,$AppProcessId,$filePathResolved)) {
    throw 'Owned native filename control did not accept the fixture path.'
  }
}
$buttonId=if($Action -eq 'cancel') {2} else {1}
if(-not [SeyvoFileDialog]::ClickAction([IntPtr]$dialog.Current.NativeWindowHandle,$AppProcessId,$buttonId)) {throw 'Owned dialog action button could not be invoked.'}
'Owned file dialog completed.'
