using System.Management;
using FloppyAutoReader.Core;
using Microsoft.Extensions.Logging;

namespace FloppyAutoReader.Windows;

public sealed class Win32VolumeWatcher(ILogger<Win32VolumeWatcher> logger) : IRemovableDriveWatcher
{
    private ManagementEventWatcher? _watcher;

    public event EventHandler<DriveChangedEventArgs>? DriveArrived;
    public event EventHandler<DriveChangedEventArgs>? DriveRemoved;

    public void Start()
    {
        var query = new WqlEventQuery("SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2 OR EventType = 3");
        _watcher = new ManagementEventWatcher(query);
        _watcher.EventArrived += OnEventArrived;
        _watcher.Start();
    }

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
        _watcher?.Dispose();
    }
}
