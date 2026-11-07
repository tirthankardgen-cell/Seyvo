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

  !macro customPageAfterChangeDir
  Function SeyvoOptionsPage
    ${If} ${isUpdated}
      Abort
    ${EndIf}
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

    Page custom SeyvoOptionsPage SeyvoOptionsLeave
  !macroend

  !macro customInstall
    ; Launch the executable even when a previous Start menu link is stale.
    StrCpy $launchLink "$appExe"
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

  !macro customFinishPage
    Function SeyvoLaunchAfterSetup
      ; Setup is per-user and never elevated. Launch directly as this user;
      ; shell-link resolution must not prevent opening the installed app.
      Exec '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\"'
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONEXCLAMATION "Seyvo was installed, but could not be opened. Start it from the desktop or Start menu shortcut."
      ${EndIf}
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Run Seyvo"
    !define MUI_FINISHPAGE_RUN_FUNCTION SeyvoLaunchAfterSetup
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif
