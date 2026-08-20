using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace Eason.VrchatStatusSync
{
    internal sealed class BadgeConfig
    {
        public string Name { get; set; }
        public string Image { get; set; }
    }

    internal sealed class GroupConfig
    {
        public string Name { get; set; }
        public string Icon { get; set; }
    }

    internal sealed class SyncConfig
    {
        public string Endpoint { get; set; }
        public string UploadSecretProtected { get; set; }
        public int HeartbeatSeconds { get; set; }
        public string DisplayName { get; set; }
        public string Pronouns { get; set; }
        public string Bio { get; set; }
        public string AvatarUrl { get; set; }
        public string CoverUrl { get; set; }
        public string Availability { get; set; }
        public string StatusDescription { get; set; }
        public BadgeConfig[] Badges { get; set; }
        public GroupConfig[] Groups { get; set; }
    }

    internal sealed class Program
    {
        private static readonly Regex LogTimestampRegex = new Regex(
            @"^(?<time>\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2})",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex WorldRegex = new Regex(
            @"\[Behaviour\]\s+Joining or Creating Room:\s*(?<world>.+?)\s*$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer { MaxJsonLength = 32768 };
        private readonly HttpClient http = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
        private string configPath;
        private SyncConfig config;
        private string uploadSecret;
        private DateTime configLastWriteUtc;
        private string currentLogPath;
        private long currentLogPosition;
        private string currentWorld = string.Empty;
        private DateTime worldStartedUtc = DateTime.UtcNow;
        private DateTime lastOnlineUtc = DateTime.MinValue;
        private DateTime nextHeartbeatUtc = DateTime.MinValue;
        private DateTime nextRetryUtc = DateTime.MinValue;
        private bool retryPending;
        private bool lastRunning;
        private bool hasSentInitialState;
        private bool dryRun;
        private bool once;

        private static int Main(string[] args)
        {
            try
            {
                return new Program().Run(args);
            }
            catch (Exception error)
            {
                Console.Error.WriteLine("启动失败：" + error.Message);
                return 1;
            }
        }

        private int Run(string[] args)
        {
            ParseArguments(args);
            ReloadConfig(true);
            http.DefaultRequestHeaders.UserAgent.ParseAdd("EasonVrchatStatusSync/1.0 (contact: contact@easonzhan.xyz)");

            if (once)
            {
                bool running = IsVrchatRunning();
                if (running)
                {
                    lastOnlineUtc = DateTime.UtcNow;
                    ScanLatestLogFromStart();
                }
                else
                {
                    lastOnlineUtc = FindLatestLogWriteUtc();
                }
                SendStatus(running);
                return 0;
            }

            Log("同步程序已启动");
            while (true)
            {
                bool configChanged = ReloadConfig(false);
                bool running = IsVrchatRunning();
                if (running || lastRunning) lastOnlineUtc = DateTime.UtcNow;
                else if (lastOnlineUtc == DateTime.MinValue) lastOnlineUtc = FindLatestLogWriteUtc();
                bool worldChanged = running && ReadLogUpdates();

                bool shouldSend = retryPending || configChanged || worldChanged || running != lastRunning;
                if (!hasSentInitialState) shouldSend = true;
                if (running && DateTime.UtcNow >= nextHeartbeatUtc) shouldSend = true;

                if (shouldSend && DateTime.UtcNow >= nextRetryUtc)
                {
                    if (TrySendStatus(running))
                    {
                        hasSentInitialState = true;
                        retryPending = false;
                        nextHeartbeatUtc = DateTime.UtcNow.AddSeconds(HeartbeatSeconds());
                    }
                    else
                    {
                        retryPending = true;
                        nextRetryUtc = DateTime.UtcNow.AddSeconds(15);
                    }
                }

                if (!running && lastRunning)
                {
                    currentWorld = string.Empty;
                    currentLogPath = null;
                    currentLogPosition = 0;
                }

                lastRunning = running;
                Thread.Sleep(running ? 3000 : 12000);
            }
        }

        private void ParseArguments(string[] args)
        {
            string defaultDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "EasonVrchatStatus");
            configPath = Path.Combine(defaultDirectory, "config.json");

            for (int index = 0; index < args.Length; index += 1)
            {
                string argument = args[index];
                if (string.Equals(argument, "--dry-run", StringComparison.OrdinalIgnoreCase)) dryRun = true;
                else if (string.Equals(argument, "--once", StringComparison.OrdinalIgnoreCase)) once = true;
                else if (string.Equals(argument, "--config", StringComparison.OrdinalIgnoreCase) && index + 1 < args.Length)
                {
                    configPath = Path.GetFullPath(args[index + 1]);
                    index += 1;
                }
            }
        }

        private bool ReloadConfig(bool required)
        {
            if (!File.Exists(configPath))
            {
                if (required) throw new FileNotFoundException("找不到配置文件", configPath);
                return false;
            }

            DateTime lastWrite = File.GetLastWriteTimeUtc(configPath);
            if (!required && lastWrite == configLastWriteUtc) return false;

            string json = File.ReadAllText(configPath, Encoding.UTF8);
            SyncConfig loaded = serializer.Deserialize<SyncConfig>(json);
            if (loaded == null) throw new InvalidDataException("配置文件格式无效");
            ValidateConfig(loaded, !dryRun);
            config = loaded;
            uploadSecret = dryRun ? string.Empty : DecryptSecret(loaded.UploadSecretProtected);
            configLastWriteUtc = lastWrite;
            return true;
        }

        private static void ValidateConfig(SyncConfig value, bool requireSecret)
        {
            Uri endpoint;
            if (!Uri.TryCreate(value.Endpoint, UriKind.Absolute, out endpoint))
                throw new InvalidDataException("Endpoint 不是有效网址");
            bool localHttp = endpoint.Scheme == Uri.UriSchemeHttp &&
                (endpoint.Host == "127.0.0.1" || endpoint.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase));
            if (endpoint.Scheme != Uri.UriSchemeHttps && !localHttp)
                throw new InvalidDataException("Endpoint 必须使用 HTTPS；本地测试只允许 localhost HTTP");
            if (requireSecret && string.IsNullOrWhiteSpace(value.UploadSecretProtected))
                throw new InvalidDataException("UploadSecretProtected 尚未配置，请先运行安装脚本");
            if (string.IsNullOrWhiteSpace(value.DisplayName)) value.DisplayName = "EasonZhan";
            if (value.Badges == null) value.Badges = new BadgeConfig[0];
            if (value.Groups == null) value.Groups = new GroupConfig[0];
        }

        private static string DecryptSecret(string protectedValue)
        {
            try
            {
                byte[] encrypted = Convert.FromBase64String(protectedValue);
                byte[] clear = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
                try
                {
                    return Encoding.UTF8.GetString(clear);
                }
                finally
                {
                    Array.Clear(clear, 0, clear.Length);
                }
            }
            catch (Exception error)
            {
                throw new InvalidDataException("无法解密上传密钥，请使用当前 Windows 账户重新运行安装脚本", error);
            }
        }

        private int HeartbeatSeconds()
        {
            return Math.Max(30, Math.Min(300, config.HeartbeatSeconds <= 0 ? 60 : config.HeartbeatSeconds));
        }

        private static bool IsVrchatRunning()
        {
            Process[] processes = Process.GetProcessesByName("VRChat");
            try
            {
                return processes.Length > 0;
            }
            finally
            {
                foreach (Process process in processes) process.Dispose();
            }
        }

        private string LogDirectory()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "AppData", "LocalLow", "VRChat", "VRChat");
        }

        private string FindLatestLog()
        {
            string directory = LogDirectory();
            if (!Directory.Exists(directory)) return null;
            FileInfo latest = new DirectoryInfo(directory)
                .GetFiles("output_log_*.txt", SearchOption.TopDirectoryOnly)
                .OrderByDescending(file => file.LastWriteTimeUtc)
                .FirstOrDefault();
            return latest == null ? null : latest.FullName;
        }

        private DateTime FindLatestLogWriteUtc()
        {
            string latest = FindLatestLog();
            if (string.IsNullOrEmpty(latest) || !File.Exists(latest)) return DateTime.MinValue;
            DateTime lastWrite = File.GetLastWriteTimeUtc(latest);
            return lastWrite > DateTime.UtcNow ? DateTime.UtcNow : lastWrite;
        }

        private void ScanLatestLogFromStart()
        {
            currentLogPath = FindLatestLog();
            currentLogPosition = 0;
            if (currentLogPath != null) ReadLogFile(true);
        }

        private bool ReadLogUpdates()
        {
            string latest = FindLatestLog();
            if (latest == null) return false;
            if (!string.Equals(latest, currentLogPath, StringComparison.OrdinalIgnoreCase))
            {
                currentLogPath = latest;
                currentLogPosition = 0;
                return ReadLogFile(true);
            }
            return ReadLogFile(false);
        }

        private bool ReadLogFile(bool fromStart)
        {
            if (string.IsNullOrEmpty(currentLogPath) || !File.Exists(currentLogPath)) return false;
            bool changed = false;
            using (FileStream stream = new FileStream(currentLogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                if (!fromStart && currentLogPosition <= stream.Length) stream.Position = currentLogPosition;
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8, true, 4096, true))
                {
                    string line;
                    while ((line = reader.ReadLine()) != null)
                    {
                        Match worldMatch = WorldRegex.Match(line);
                        if (!worldMatch.Success) continue;
                        string world = SanitizeWorldLabel(worldMatch.Groups["world"].Value);
                        if (string.IsNullOrEmpty(world)) continue;
                        DateTime enteredAt = ParseLogTime(line);
                        if (!string.Equals(world, currentWorld, StringComparison.Ordinal))
                        {
                            currentWorld = world;
                            worldStartedUtc = enteredAt;
                            changed = true;
                        }
                    }
                }
                currentLogPosition = stream.Position;
            }
            return changed;
        }

        private static DateTime ParseLogTime(string line)
        {
            Match match = LogTimestampRegex.Match(line);
            DateTime parsed;
            if (match.Success && DateTime.TryParseExact(
                match.Groups["time"].Value,
                "yyyy.MM.dd HH:mm:ss",
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeLocal,
                out parsed))
            {
                return parsed.ToUniversalTime();
            }
            return DateTime.UtcNow;
        }

        private static string SanitizeWorldLabel(string value)
        {
            string world = (value ?? string.Empty).Trim();
            if (world.Length > 120) world = world.Substring(0, 120);
            if (Regex.IsMatch(world, @"wrld_[0-9a-f-]+|~|nonce|region\(", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                return "私人世界";
            return world;
        }

        private Dictionary<string, object> BuildPayload(bool online)
        {
            string availability = NormalizeAvailability(config.Availability, online);
            List<Dictionary<string, object>> badges = config.Badges
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.Name) && IsHttpsUrl(item.Image))
                .Take(12)
                .Select(item => new Dictionary<string, object> { { "name", item.Name.Trim() }, { "image", item.Image.Trim() } })
                .ToList();
            List<Dictionary<string, object>> groups = config.Groups
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.Name))
                .Take(3)
                .Select(item => new Dictionary<string, object> { { "name", item.Name.Trim() }, { "icon", IsHttpsUrl(item.Icon) ? item.Icon.Trim() : string.Empty } })
                .ToList();

            Dictionary<string, object> payload = new Dictionary<string, object>
            {
                { "online", online },
                { "status", availability },
                { "status_description", online ? Safe(config.StatusDescription, 100) : string.Empty },
                { "display_name", Safe(config.DisplayName, 64) },
                { "pronouns", Safe(config.Pronouns, 32) },
                { "bio", Safe(config.Bio, 700) },
                { "avatar_url", IsHttpsUrl(config.AvatarUrl) ? config.AvatarUrl.Trim() : string.Empty },
                { "cover_url", IsHttpsUrl(config.CoverUrl) ? config.CoverUrl.Trim() : string.Empty },
                { "badges", badges },
                { "groups", groups },
                { "world_label", online ? currentWorld : string.Empty },
                { "world_started_at", online && !string.IsNullOrEmpty(currentWorld) ? worldStartedUtc.ToString("o", CultureInfo.InvariantCulture) : string.Empty },
                { "last_online_at", !online && lastOnlineUtc != DateTime.MinValue ? lastOnlineUtc.ToString("o", CultureInfo.InvariantCulture) : string.Empty }
            };
            return payload;
        }

        private static string NormalizeAvailability(string value, bool online)
        {
            if (!online) return "offline";
            string status = (value ?? string.Empty).Trim().ToLowerInvariant();
            return status == "join me" || status == "ask me" || status == "busy" ? status : "active";
        }

        private static string Safe(string value, int maxLength)
        {
            string text = (value ?? string.Empty).Trim();
            return text.Length <= maxLength ? text : text.Substring(0, maxLength);
        }

        private static bool IsHttpsUrl(string value)
        {
            Uri uri;
            return Uri.TryCreate(value, UriKind.Absolute, out uri) && uri.Scheme == Uri.UriSchemeHttps;
        }

        private void SendStatus(bool online)
        {
            Dictionary<string, object> payload = BuildPayload(online);
            string json = serializer.Serialize(payload);
            if (dryRun)
            {
                Console.WriteLine(json);
                return;
            }

            long timestamp = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
            string timestampText = timestamp.ToString(CultureInfo.InvariantCulture);
            string signature;
            using (HMACSHA256 hmac = new HMACSHA256(Encoding.UTF8.GetBytes(uploadSecret)))
            {
                byte[] digest = hmac.ComputeHash(Encoding.UTF8.GetBytes(timestampText + "\n" + json));
                signature = BitConverter.ToString(digest).Replace("-", string.Empty).ToLowerInvariant();
            }

            using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, config.Endpoint))
            {
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
                request.Headers.TryAddWithoutValidation("X-Status-Timestamp", timestampText);
                request.Headers.TryAddWithoutValidation("X-Status-Signature", signature);
                using (HttpResponseMessage response = http.SendAsync(request).GetAwaiter().GetResult())
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        throw new HttpRequestException("状态接口返回 " + (int)response.StatusCode);
                    }
                }
            }
        }

        private bool TrySendStatus(bool online)
        {
            try
            {
                SendStatus(online);
                return true;
            }
            catch (Exception error)
            {
                // Keep the background process alive through temporary network or Worker outages.
                Log("状态上传失败：" + error.GetType().Name);
                return false;
            }
        }

        private static void Log(string message)
        {
            try
            {
                string directory = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "EasonVrchatStatus");
                Directory.CreateDirectory(directory);
                string path = Path.Combine(directory, "sync.log");
                if (File.Exists(path) && new FileInfo(path).Length > 512 * 1024)
                    File.WriteAllText(path, string.Empty, Encoding.UTF8);
                File.AppendAllText(path, DateTime.Now.ToString("s") + " " + message + Environment.NewLine, Encoding.UTF8);
            }
            catch
            {
                // Logging must never stop status synchronization.
            }
        }
    }
}
