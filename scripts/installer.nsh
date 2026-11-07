!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Seyvo"
!macroend

!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  Var seyvoDesktopShortcut
  Var seyvoDesktopCheckbox

  !macro customInit
    StrCpy $seyvoDesktopShortcut ${BST_CHECKED}
  !macroend

  Function SeyvoOptionsPage
    !insertmacro MUI_HEADER_TEXT "Installation options" "Choose how to open Seyvo."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 0 100% 16u "Create a desktop shortcut"
    Pop $seyvoDesktopCheckbox
    ${NSD_SetState} $seyvoDesktopCheckbox $seyvoDesktopShortcut
    ${NSD_CreateLabel} 0 26u 100% 30u "Run Seyvo is selected on the final page. You can uncheck either option."
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function SeyvoOptionsLeave
    ${NSD_GetState} $seyvoDesktopCheckbox $seyvoDesktopShortcut
  FunctionEnd

  !macro customPageAfterChangeDir
    !insertmacro skipPageIfUpdated
    Page custom SeyvoOptionsPage SeyvoOptionsLeave
  !macroend

  !macro customInstall
    ${If} ${isNoDesktopShortcut}
      StrCpy $seyvoDesktopShortcut ${BST_UNCHECKED}
    ${EndIf}
    ${If} $seyvoDesktopShortcut == ${BST_CHECKED}
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${Else}
      WinShell::UninstShortcut "$newDesktopLink"
      Delete "$newDesktopLink"
    ${EndIf}
  !macroend
!endif
