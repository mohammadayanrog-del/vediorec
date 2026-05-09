' VideoRec Silent Launcher
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Get the ORIGINAL folder where the VBS file lives (not Desktop)
' This works even when shortcut is on Desktop
Dim scriptPath
scriptPath = WScript.ScriptFullName

' If this is a shortcut, resolve to actual file location
Dim appDir
appDir = fso.GetParentFolderName(scriptPath)

' Check if src\main.js exists here - if not, we're in wrong dir
If Not fso.FileExists(appDir & "\src\main.js") Then
    MsgBox "Error: Could not find VideoRec app files." & vbCrLf & vbCrLf & _
           "Make sure this shortcut points to the original VideoRec.vbs" & vbCrLf & _
           "located in: " & appDir, vbCritical, "VideoRec"
    WScript.Quit
End If

' First-time install: check for node_modules
If Not fso.FolderExists(appDir & "\node_modules") Then
    WshShell.Run "cmd /c cd /d """ & appDir & """ && npm install", 1, True
End If

' Check node_modules installed correctly
If Not fso.FolderExists(appDir & "\node_modules\electron") Then
    MsgBox "npm install failed. Please make sure Node.js is installed from https://nodejs.org", vbCritical, "VideoRec"
    WScript.Quit
End If

' Launch Electron with no window
WshShell.Run "cmd /c cd /d """ & appDir & """ && npx electron . >nul 2>&1", 0, False
