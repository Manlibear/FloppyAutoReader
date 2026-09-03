using System.Diagnostics;
using System.Text.RegularExpressions;
using FloppyAutoReader.Core;
using Microsoft.Extensions.Options;

namespace FloppyAutoReader.Linux;

public sealed class FileSystemDriveWatcher(ILogger<FileSystemDriveWatcher> logger, IOptions<FloppyAutoReaderOptions> options) : IRemovableDriveWatcher
{
    private readonly List<FileSystemWatcher> _watchers = [];

    public event EventHandler<DriveChangedEventArgs>? DriveArrived;
    public event EventHandler<DriveChangedEventArgs>? DriveRemoved;
    private FloppyAutoReaderOptions _options => options.Value;
    private Process? _udevProcess;

    public void Start()
    {
        var user = Environment.UserName;
        string[] candidateRoots = [$"/run/media/{user}", $"/media/{user}", "/media"];

        foreach (var root in candidateRoots.Distinct())
        {
            if (!Directory.Exists(root))
            {
                logger.LogDebug("Mount root {Root} does not exist, skipping.", root);
                continue;
            }

            var watcher = new FileSystemWatcher(root)
            {
                NotifyFilter = NotifyFilters.DirectoryName,
                IncludeSubdirectories = false,
            };
            watcher.Created += (_, e) => DriveArrived?.Invoke(this, new DriveChangedEventArgs(e.FullPath));
            watcher.Deleted += (_, e) => DriveRemoved?.Invoke(this, new DriveChangedEventArgs(e.FullPath));
            watcher.EnableRaisingEvents = true;
            _watchers.Add(watcher);
            logger.LogInformation("Watching {Root} for drive mount/unmount.", root);
        }

        if (_watchers.Count == 0)
        {
            logger.LogWarning(
                "No removable-media mount roots found (checked {Roots}). Drives auto-mounted elsewhere won't be detected.",
                string.Join(", ", candidateRoots));
        }

        if(_options.AutoMountDrivesLinux)
        {
            StartUdev();
        }
    }

    private void StartUdev()
    {
        logger.LogInformation("Starting udev monitoring for auto-mounting drives.");
        _udevProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "udevadm",
                Arguments = "monitor --udev --subsystem-match=block --property",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };
        
        _udevProcess.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                var eventData = Regex.Match(e.Data, @"(add|remove).*\/block\/[A-Za-z0-9]*\/([A-Za-z0-9]*)\s");

                if(eventData.Success)
                {
                    var action = eventData.Groups[1].Value;
                    var devicePath = $"/dev/{eventData.Groups[2].Value}";

                    if (action == "add")
                    {
                        var success = new Process
                        {
                            StartInfo = new ProcessStartInfo
                            {
                                FileName = "udisksctl",
                                Arguments = $"mount -b {devicePath}",
                                RedirectStandardOutput = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            }
                        }.Start();
                    }
                }
            }
        };

        if(_udevProcess.Start())
        {
            _udevProcess.BeginOutputReadLine();
            logger.LogInformation("Udev monitoring started successfully.");
        }
        else
        {
            logger.LogError("Failed to start udev monitoring.");
        }
        
    }

    public void Dispose()
    {
        _udevProcess?.Kill();
        foreach (var watcher in _watchers) watcher.Dispose();
    }
}
