using System.Management;
using FloppyAutoReader.Core;
using Microsoft.Extensions.Logging;

namespace FloppyAutoReader.Windows;

public sealed class Win32VolumeWatcher(ILogger<Win32VolumeWatcher> logger) : IRemovableDriveWatcher
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);

    private ManagementEventWatcher? _watcher;
    private Timer? _pollTimer;
    private readonly object _pollLock = new();
    private readonly HashSet<string> _readyRemovableDrives = new(StringComparer.OrdinalIgnoreCase);

    public event EventHandler<DriveChangedEventArgs>? DriveArrived;
    public event EventHandler<DriveChangedEventArgs>? DriveRemoved;

    public void Start()
    {
        var query = new WqlEventQuery("SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2 OR EventType = 3");
        _watcher = new ManagementEventWatcher(query);
        _watcher.EventArrived += OnEventArrived;
        _watcher.Start();

        // Classic floppy drives have no media-change notification line, so
        // Win32_VolumeChangeEvent never fires when a disk is swapped in a drive
        // letter that's already mounted. Poll readiness as a fallback; a swap
        // always dips through not-ready in between, so it still shows up as a
        // removal+arrival transition here even though WMI stays silent.
        // Seed the baseline without raising events so a disk already sitting in
        // the drive when the service starts still doesn't auto-launch.
        _readyRemovableDrives.UnionWith(GetReadyRemovableDrives());
        _pollTimer = new Timer(_ => Poll(), null, PollInterval, PollInterval);
    }

    private void Poll()
    {
        lock (_pollLock)
        {
            var current = GetReadyRemovableDrives();

            foreach (var rootPath in current)
            {
                if (_readyRemovableDrives.Add(rootPath))
                {
                    DriveArrived?.Invoke(this, new DriveChangedEventArgs(rootPath));
                }
            }

            foreach (var rootPath in _readyRemovableDrives.Where(d => !current.Contains(d)).ToList())
            {
                _readyRemovableDrives.Remove(rootPath);
                DriveRemoved?.Invoke(this, new DriveChangedEventArgs(rootPath));
            }
        }
    }

    private static HashSet<string> GetReadyRemovableDrives() =>
        DriveInfo.GetDrives()
            .Where(d => d.DriveType == DriveType.Removable && d.IsReady)
            .Select(d => d.RootDirectory.FullName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

    private void OnEventArrived(object sender, EventArrivedEventArgs e)
    {
        try
        {
            var driveLetter = e.NewEvent.Properties["DriveName"]?.Value?.ToString();
            if (string.IsNullOrWhiteSpace(driveLetter)) return; // but like, how?

            var eventType = Convert.ToInt32(e.NewEvent.Properties["EventType"]?.Value ?? 0);
            var rootPath = driveLetter.EndsWith(':') ? driveLetter + "\\" : driveLetter;

            switch (eventType)
            {
                case 2:
                    DriveArrived?.Invoke(this, new DriveChangedEventArgs(rootPath));
                    break;
                case 3:
                    DriveRemoved?.Invoke(this, new DriveChangedEventArgs(rootPath));
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error handling volume change event.");
        }
    }

    public void Dispose()
    {
        _pollTimer?.Dispose();
        _watcher?.Dispose();
    }
}
