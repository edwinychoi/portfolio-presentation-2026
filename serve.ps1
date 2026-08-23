# Static preview: http://127.0.0.1:4173/ (or the next free port)
# Run:  .\serve.ps1          — server only
#       .\serve.ps1 -Open    — also open your default browser
param(
  [switch] $Open,
  [int] $Port = 4173
)

$ErrorActionPreference = "Stop"
$rootFull = [IO.Path]::GetFullPath($PSScriptRoot)

Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

public static class TinyStaticHost {
  public static void Run(string prefix, string rootDir, bool openBrowser) {
    var root = Path.GetFullPath(rootDir);
    var listener = new HttpListener();
    listener.Prefixes.Add(prefix);
    listener.Start();
    Console.WriteLine("Serving " + root);
    Console.WriteLine("  " + prefix);
    Console.WriteLine("(Ctrl+C to stop)");
    if (openBrowser) {
      Process.Start(new ProcessStartInfo { FileName = prefix, UseShellExecute = true });
    }
    while (listener.IsListening) {
      var ctx = listener.GetContext();
      ThreadPool.QueueUserWorkItem(_ => Handle(ctx, root));
    }
  }

  static void Handle(HttpListenerContext ctx, string root) {
    try {
      var path = Uri.UnescapeDataString(ctx.Request.Url.AbsolutePath);
      if (path == "/" || path == "") path = "/index.html";
      var rel = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
      var local = Path.GetFullPath(Path.Combine(root, rel));
      var res = ctx.Response;
      res.KeepAlive = false;
      res.Headers["Cache-Control"] = "no-store";
      if (!local.StartsWith(root, StringComparison.OrdinalIgnoreCase)) {
        res.StatusCode = 403;
        res.Close();
        return;
      }
      if (!File.Exists(local)) {
        res.StatusCode = 404;
        var missing = System.Text.Encoding.UTF8.GetBytes("Not found");
        res.ContentLength64 = missing.LongLength;
        res.OutputStream.Write(missing, 0, missing.Length);
        res.Close();
        return;
      }
      var ext = Path.GetExtension(local).ToLowerInvariant();
      var mime = "application/octet-stream";
      if (ext == ".html") mime = "text/html; charset=utf-8";
      else if (ext == ".css") mime = "text/css; charset=utf-8";
      else if (ext == ".js" || ext == ".mjs") mime = "text/javascript; charset=utf-8";
      else if (ext == ".pdf") mime = "application/pdf";
      else if (ext == ".png") mime = "image/png";
      else if (ext == ".jpg" || ext == ".jpeg") mime = "image/jpeg";
      else if (ext == ".svg") mime = "image/svg+xml";
      else if (ext == ".woff2") mime = "font/woff2";
      else if (ext == ".webm") mime = "video/webm";
      else if (ext == ".mp4") mime = "video/mp4";
      else if (ext == ".mov") mime = "video/quicktime";
      res.ContentType = mime;
      res.AddHeader("Accept-Ranges", "bytes");
      var length = new FileInfo(local).Length;
      var range = ctx.Request.Headers["Range"];
      long start = 0;
      long end = length - 1;
      if (!string.IsNullOrEmpty(range) && range.StartsWith("bytes=")) {
        var spec = range.Substring(6);
        var parts = spec.Split('-');
        if (parts.Length > 0 && parts[0] != "") start = long.Parse(parts[0]);
        if (parts.Length > 1 && parts[1] != "") end = long.Parse(parts[1]);
        if (start < 0) start = 0;
        if (end >= length) end = length - 1;
        if (start > end) start = 0;
        res.StatusCode = 206;
        res.AddHeader("Content-Range", "bytes " + start + "-" + end + "/" + length);
      }
      var count = (int)(end - start + 1);
      res.ContentLength64 = count;
      using (var fs = File.OpenRead(local)) {
        fs.Seek(start, SeekOrigin.Begin);
        var buffer = new byte[81920];
        var remaining = count;
        while (remaining > 0) {
          var read = fs.Read(buffer, 0, Math.Min(buffer.Length, remaining));
          if (read <= 0) break;
          res.OutputStream.Write(buffer, 0, read);
          remaining -= read;
        }
      }
      res.Close();
    } catch {
      try { ctx.Response.Abort(); } catch {}
    }
  }
}
"@

$bound = $false
foreach ($tryPort in $Port..($Port + 12)) {
  $prefix = "http://127.0.0.1:$tryPort/"
  try {
    [TinyStaticHost]::Run($prefix, $rootFull, [bool]$Open)
    $bound = $true
    break
  } catch {
    $msg = [string]$_.Exception.Message
    if ($_.Exception.InnerException) { $msg += " " + $_.Exception.InnerException.Message }
    if ($msg -match "conflicts|Access is denied") {
      Write-Host "Port $tryPort busy, trying next..." -ForegroundColor DarkYellow
      continue
    }
    throw
  }
}

if (-not $bound) { throw "Could not bind a port starting at $Port" }
