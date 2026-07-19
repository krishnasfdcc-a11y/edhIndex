using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace EdhIndex.Sample
{
    public enum UserRole
    {
        Admin,
        User,
        Viewer
    }

    public class UserConfig
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public UserRole Role { get; set; } = UserRole.Viewer;
        public Dictionary<string, object>? Settings { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool Validate()
        {
            if (string.IsNullOrEmpty(Name) || Name.Length < 2) return false;
            if (!Email.Contains('@')) return false;
            return true;
        }
    }

    public class ApiResponse<T>
    {
        public int Status { get; set; }
        public T? Data { get; set; }
        public string Message { get; set; } = string.Empty;
        public long Timestamp { get; set; }

        public ApiResponse(int status, T? data, string message)
        {
            Status = status;
            Data = data;
            Message = message;
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }

    public abstract class BaseService
    {
        protected string BaseUrl { get; }
        protected int TimeoutMs { get; }

        protected BaseService(string baseUrl, int timeoutMs = 5000)
        {
            BaseUrl = baseUrl;
            TimeoutMs = timeoutMs;
        }

        protected void Log(string method, string path)
        {
            Console.WriteLine($"[{method}] {BaseUrl}{path}");
        }
    }

    public class UserService : BaseService
    {
        private readonly Dictionary<string, UserConfig> _users = new();
        private readonly ReaderWriterLockSlim _lock = new();
        private readonly List<Action<UserConfig>> _listeners = new();

        public UserService() : base("https://api.example.com/users") { }

        public ApiResponse<UserConfig> GetUser(string id)
        {
            _lock.EnterReadLock();
            try
            {
                if (_users.TryGetValue(id, out var user))
                {
                    foreach (var listener in _listeners) listener(user);
                    return new ApiResponse<UserConfig>(200, user, "OK");
                }
                return new ApiResponse<UserConfig>(404, default, "Not found");
            }
            finally { _lock.ExitReadLock(); }
        }

        public ApiResponse<UserConfig> CreateUser(UserConfig config)
        {
            if (!config.Validate())
                return new ApiResponse<UserConfig>(400, default, "Invalid config");

            var id = GenerateId();
            _lock.EnterWriteLock();
            try
            {
                _users[id] = config;
            }
            finally { _lock.ExitWriteLock(); }

            foreach (var listener in _listeners) listener(config);
            return new ApiResponse<UserConfig>(201, config, "Created");
        }

        public ApiResponse<UserConfig> UpdateUser(string id, Dictionary<string, string> updates)
        {
            _lock.EnterUpgradeableReadLock();
            try
            {
                if (!_users.TryGetValue(id, out var user))
                    return new ApiResponse<UserConfig>(404, default, "Not found");

                if (updates.TryGetValue("name", out var name)) user.Name = name;
                if (updates.TryGetValue("email", out var email)) user.Email = email;

                return new ApiResponse<UserConfig>(200, user, "Updated");
            }
            finally { _lock.ExitUpgradeableReadLock(); }
        }

        public ApiResponse<object> DeleteUser(string id)
        {
            _lock.EnterWriteLock();
            try
            {
                if (!_users.Remove(id))
                    return new ApiResponse<object>(404, null!, "Not found");
                return new ApiResponse<object>(200, null!, "Deleted");
            }
            finally { _lock.ExitWriteLock(); }
        }

        public List<UserConfig> ListUsers()
        {
            _lock.EnterReadLock();
            try
            {
                return _users.Values.ToList();
            }
            finally { _lock.ExitReadLock(); }
        }

        public void OnEvent(Action<UserConfig> listener)
        {
            _listeners.Add(listener);
        }

        private static string GenerateId()
        {
            var bytes = new byte[16];
            RandomNumberGenerator.Fill(bytes);
            return Convert.ToHexString(bytes).ToLower()[..16];
        }
    }

    public static class Utils
    {
        public static string CalculateHash(string content)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(content));
            return Convert.ToHexString(bytes).ToLower();
        }

        public static bool ValidateEmail(string email)
        {
            if (string.IsNullOrEmpty(email)) return false;
            var at = email.IndexOf('@');
            if (at <= 0) return false;
            var dot = email.IndexOf('.', at);
            return dot > at + 1 && dot < email.Length - 1;
        }

        public static PaginatedResult<T> Paginate<T>(List<T> items, int page, int perPage)
        {
            var start = (page - 1) * perPage;
            var end = Math.Min(start + perPage, items.Count);
            var pages = items.Count == 0 ? 0 : (items.Count + perPage - 1) / perPage;
            return new PaginatedResult<T>
            {
                Items = items[start..end],
                Total = items.Count,
                Pages = pages
            };
        }

        public static UserConfig? ReadConfig(string path)
        {
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<UserConfig>(json);
        }

        public static void WriteConfig(string path, UserConfig config)
        {
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(path, json);
        }
    }

    public class PaginatedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int Total { get; set; }
        public int Pages { get; set; }
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            var service = new UserService();
            var config = new UserConfig { Name = "Alice", Email = "alice@example.com", Role = UserRole.Admin };
            var result = service.CreateUser(config);
            Console.WriteLine($"Created: {result.Message}");
        }
    }
}
