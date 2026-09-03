using FloppyAutoReader.Core;
using FloppyAutoReader.Linux;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<FloppyAutoReaderOptions>(builder.Configuration.GetSection(FloppyAutoReaderOptions.SectionName));
builder.Services.AddSingleton<IRemovableDriveWatcher, FileSystemGameDriveWatcher>();
builder.Services.AddSingleton<IGameLauncher, XdgOpenLauncher>();
builder.Services.AddHostedService<DiskWatcherService>();

var host = builder.Build();
host.Run();
