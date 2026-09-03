namespace FloppyAutoReader.Core;

public sealed class DriveChangedEventArgs(string rootPath) : EventArgs
{
    public string RootPath { get; } = rootPath;
}

public interface IRemovableDriveWatcher : IDisposable
{
    event EventHandler<DriveChangedEventArgs>? DriveArrived;
    event EventHandler<DriveChangedEventArgs>? DriveRemoved;

    void Start();
}
