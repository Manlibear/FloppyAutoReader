# Floppy Auto Reader

Watches for a mounted floppy disk (only currently via USB external readers, internal ones will need some work since they won't generate udev events (I think, right?) in Linux on insert/remove, have to poke at /dev/fd0) and auto-launches whatever game is mapped to the current machine in that disk's `game.dsk` file.

## How it works

1. `game.dsk` lives at the root of the disk and is a JSON object mapping machine name -> launch target, e.g.:

   ```json
   {
     "bear-pc": "steam://rungameid/916440",
     "bear-laptop": "/home/manlibear/Games/HalfLife3.AppImage -vulkan"
   }
   ```

2. Detection is event-driven, not polling. When `game.dsk` is found, it's matched against the current machine name (case-insensitive). A disk is only launched once per physical insertion: its content hash is remembered while the drive stays present, and forgotten as soon as the drive is removed, so reinserting the same disk fires again.

3. This means a disk that's already inserted when the service starts (e.g. left in the reader across a reboot) does **not** auto-launch — only an actual insertion event does.

## Project structure

```
FloppyAutoReader.Core/     shared logic, no OS-specific dependencies
FloppyAutoReader.Windows/  Windows Service, WMI drive detection, ShellExecute launch
FloppyAutoReader.Linux/    systemd unit, inotify-based drive detection, xdg-open launch
```

`FloppyAutoReader.Core` owns the mapping-file parsing, hash-based dedupe, and machine-name matching (`DiskWatcherService`) behind two interfaces each platform project implements:

- `IRemovableDriveWatcher` — event-driven arrival/removal of a removable drive's mount path
- `IGameLauncher` — launching a mapped target string

### Windows

- Detection: WMI `Win32_VolumeChangeEvent` (`Win32VolumeWatcher`) — arrival is `EventType 2`, removal is `EventType 3`.
- Launch: `Process.Start(UseShellExecute = true)` (`ShellExecuteLauncher`),
  so a target can be a `.exe` path, a registered URI protocol (`steam://...`), or a `shell:AppsFolder\...` reference for Xbox/UWP apps
  — Windows resolves whichever it is.

### Linux

- Detection: `FileSystemWatcher` (inotify) on the directories udisks2/GVfs auto-mount removable filesystems under (`FileSystemGameDriveWatcher`). This is a starting point, not the robust long-term answer — it only sees mounts landing under those specific roots and treats directory creation as "arrived" even though the mount may still be settling, so we'll do a little round of polling just to give it time
- Launch: `xdg-open` (`XdgOpenLauncher`) — there's no single Linux API that resolves "path, URI, or app reference" the way `ShellExecute` does on Windows, so `game.dsk` entries for Linux machines need can either be a `steam://` URI, or we'll just blindly launch whatever is there, args and all. So you know, hilarious attack vector really.

## Configuration

Each platform project has its own `appsettings.json`:

```json
{
  "FloppyAutoReader": {
    "GameFileName": "game.dsk",
    "WatchRemovableDrives": true,
    "AutoMountDrivesLinux": false
  }
}
```

The latter option should probably be steered clear of, incase you are certain of wanting drives to auto-mount, since this will catch USB drives as well, probably best to use something on your own system to handle mounting the floppy specifically, but I am lazy. If do you wanna use it, look over the code in `FloppyAutoReader.Linux/FileSystemDriveWatcher.cs` because ItWorksOnMyMachine™ but I don't know about yours

## Running for development

```
dotnet run --project FloppyAutoReader.Windows   # on Windows
dotnet run --project FloppyAutoReader.Linux      # on Linux
```

Runs as a normal console app (the generic host detects it isn't running as a service and logs to the console instead).

## Installing as a service

### Windows

```
dotnet publish FloppyAutoReader.Windows/FloppyAutoReader.Windows.csproj -c Release -o publish
sc.exe create FloppyAutoReader binPath= "C:\full\path\to\publish\FloppyAutoReader.Windows.exe"
sc.exe start FloppyAutoReader
```

To uninstall:

```
sc.exe stop FloppyAutoReader
sc.exe delete FloppyAutoReader
```

### Linux (systemd user service)

```
dotnet publish FloppyAutoReader.Linux/FloppyAutoReader.Linux.csproj -c Release -o ~/Applications/floppyautoreader
mkdir -p ~/.config/systemd/user
cp FloppyAutoReader.Linux/floppyautoreader.service ~/.config/systemd/user/
systemctl --user enable --now floppyautoreader.service
```

To uninstall:

```
systemctl --user disable --now floppyautoreader.service
rm ~/.config/systemd/user/floppyautoreader.service
```
