using System.Diagnostics;
using FloppyAutoReader.Core;

namespace FloppyAutoReader.Linux;

public sealed class XdgOpenLauncher : IGameLauncher
{
    public void Launch(string target)
    {
        //TOOD: Clear this up a bit
        if (target.StartsWith("steam://"))
        {
            // Steam handles its own URI scheme, so just hand it off to xdg-open
            // and let the system figure out what to do with it.
            Process.Start(new ProcessStartInfo("xdg-open", [target])
            {
                UseShellExecute = false
            });
            return;
        }
        else
        {
            Process.Start(new ProcessStartInfo(target)
            {
                UseShellExecute = false
            });
        }
    }
}
