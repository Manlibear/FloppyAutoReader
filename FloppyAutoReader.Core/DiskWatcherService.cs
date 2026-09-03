using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FloppyAutoReader.Core;

public class DiskWatcherService(
    IRemovableDriveWatcher watcher,
    IGameLauncher launcher,
    IOptions<FloppyAutoReaderOptions> options,
    ILogger<DiskWatcherService> logger) : BackgroundService
{
    private readonly FloppyAutoReaderOptions _options = options.Value;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly Dictionary<string, string> _lastSeenHashByPath = new(StringComparer.OrdinalIgnoreCase);

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        watcher.DriveArrived += OnDriveArrived;
        watcher.DriveRemoved += OnDriveRemoved;
        watcher.Start();
        logger.LogInformation("Watching for removable drive arrival/removal.");

        return base.StartAsync(cancellationToken);
    }

    private void OnDriveArrived(object? sender, DriveChangedEventArgs e)
    {
        var rootPath = e.RootPath;
        logger.LogInformation("Detected new volume at {Path}.", rootPath);

        try
        {
            var gameFilePath = Path.Combine(rootPath, _options.GameFileName);
            if (!File.Exists(gameFilePath)) {

                int failedCount = 0;
                while (_options.AutoMountDrivesLinux && !File.Exists(gameFilePath) && failedCount != 5)
                {
                    // drive can take a sec to settle, poll a bit and see if the file appears
                    Thread.Sleep(100);
                    failedCount++;
                }

                if(!_options.AutoMountDrivesLinux || failedCount == 5)
                {
                    logger.LogInformation("Didn't find {Path}.", gameFilePath);
                    return;   
                }
            }

            logger.LogInformation("Found {File} at {Path}.", _options.GameFileName, rootPath);
            var json = File.ReadAllText(gameFilePath);
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));

            // check if we've already handled this file, it will be "forgotten" on volume removed
            if (_lastSeenHashByPath.TryGetValue(rootPath, out var lastHash) && lastHash == hash) return;

            _lastSeenHashByPath[rootPath] = hash;

            var mapping = JsonSerializer.Deserialize<Dictionary<string, string>>(json, _jsonOptions);

            if (mapping is null)
            {
                logger.LogWarning("{File} at {Path} did not parse as a JSON object of machine name -> launch target.", _options.GameFileName, rootPath);
                return;
            }

            var machineName = Environment.MachineName;
            var match = mapping.FirstOrDefault(x => x.Key.Equals(machineName, StringComparison.CurrentCultureIgnoreCase));

            if (match.Key is null)
            {
                logger.LogInformation("No entry for this machine ('{Machine}') in {File} at {Path}.", machineName, _options.GameFileName, rootPath);
                return;
            }

            logger.LogInformation("Disk at {Path} matched machine '{Machine}'. Launching: {Target}", rootPath, machineName, match.Value);
            try
            {
                launcher.Launch(match.Value);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to launch '{Target}'", match.Value);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to process potential game disk at {Path}.", rootPath);
        }
    }

    private void OnDriveRemoved(object? sender, DriveChangedEventArgs e)
    {
        logger.LogInformation("Volume removed at {Path}.", e.RootPath);
        _lastSeenHashByPath.Remove(e.RootPath);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogTrace("Shutting down");
        watcher.DriveArrived -= OnDriveArrived;
        watcher.DriveRemoved -= OnDriveRemoved;
        watcher.Dispose();
        return base.StopAsync(cancellationToken);
    }
}
