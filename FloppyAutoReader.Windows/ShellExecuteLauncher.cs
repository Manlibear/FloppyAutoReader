using System.Diagnostics;
using FloppyAutoReader.Core;

namespace FloppyAutoReader.Windows;

public sealed class ShellExecuteLauncher : IGameLauncher
{
    public void Launch(string target)
    {
        Process.Start(new ProcessStartInfo(target)
        {
            UseShellExecute = true
        });
    }
}
