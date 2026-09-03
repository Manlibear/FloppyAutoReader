namespace FloppyAutoReader.Core;

public class FloppyAutoReaderOptions
{
    public const string SectionName = "FloppyAutoReader";

    public string GameFileName { get; set; } = "game.dsk";

    public bool WatchRemovableDrives { get; set; } = true;
    public bool AutoMountDrivesLinux { get; set; } = true;
}
