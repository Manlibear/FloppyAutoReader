using FloppyAutoReader.Core;
using FloppyAutoReader.Windows;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<FloppyAutoReaderOptions>(builder.Configuration.GetSection(FloppyAutoReaderOptions.SectionName));
builder.Services.AddSingleton<IRemovableDriveWatcher, Win32VolumeWatcher>();
builder.Services.AddSingleton<IGameLauncher, ShellExecuteLauncher>();
builder.Services.AddHostedService<DiskWatcherService>();
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "FloppyAutoReader";
});

var host = builder.Build();
host.Run();
