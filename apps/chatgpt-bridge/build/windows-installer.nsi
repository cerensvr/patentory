Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
Name "Patentory Bridge"
Caption "Patentory ChatGPT Plus Köprüsü"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Patentory Bridge"
Icon "${ICON_FILE}"
UninstallIcon "${ICON_FILE}"
AutoCloseWindow true
ShowInstDetails nevershow
ShowUninstDetails nevershow

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${STAGING_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Patentory Bridge" '$WINDIR\System32\wscript.exe "$INSTDIR\start-hidden.vbs"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "DisplayName" "Patentory ChatGPT Plus Köprüsü"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "Publisher" "Patentory"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "DisplayIcon" "$INSTDIR\patentory.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\Patentory"
  CreateShortcut "$SMPROGRAMS\Patentory\Patentory'yi Aç.lnk" "$WINDIR\explorer.exe" "https://patentory.vercel.app" "$INSTDIR\patentory.ico"
  CreateShortcut "$SMPROGRAMS\Patentory\Köprüyü Kaldır.lnk" "$INSTDIR\Uninstall.exe"

  Exec '$WINDIR\System32\wscript.exe "$INSTDIR\start-hidden.vbs"'
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Patentory Bridge"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Patentory Bridge"
  Delete "$SMPROGRAMS\Patentory\Patentory'yi Aç.lnk"
  Delete "$SMPROGRAMS\Patentory\Köprüyü Kaldır.lnk"
  RMDir "$SMPROGRAMS\Patentory"
  RMDir /r "$INSTDIR"
SectionEnd
