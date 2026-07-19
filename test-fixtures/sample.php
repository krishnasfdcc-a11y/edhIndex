<?php

namespace EdhIndex\Sample;

use Exception;
use InvalidArgumentException;

enum UserRole: string
{
    case Admin = 'admin';
    case User = 'user';
    case Viewer = 'viewer';
}

class UserConfig
{
    public function __construct(
        public string $name,
        public string $email,
        public UserRole $role = UserRole::Viewer,
        public array $settings = [],
        public \DateTimeImmutable $createdAt = new \DateTimeImmutable()
    ) {}

    public function validate(): bool
    {
        if (strlen($this->name) < 2) return false;
        if (!str_contains($this->email, '@')) return false;
        return true;
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role->value,
            'created_at' => $this->createdAt->format('c'),
        ];
    }
}

class ApiResponse
{
    public readonly int $timestamp;

    public function __construct(
        public readonly int $status,
        public readonly mixed $data,
        public readonly string $message,
    ) {
        $this->timestamp = (int)(microtime(true) * 1000);
    }

    public function isOk(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }
}

abstract class BaseService
{
    public function __construct(
        protected readonly string $baseUrl,
        protected readonly int $timeout = 5000
    ) {}

    protected function log(string $method, string $path): void
    {
        error_log("[$method] {$this->baseUrl}{$path}");
    }
}

class UserService extends BaseService
{
    private array $users = [];
    private array $listeners = [];

    public function __construct()
    {
        parent::__construct('https://api.example.com/users');
    }

    public function getUser(string $id): ApiResponse
    {
        if (!isset($this->users[$id])) {
            return new ApiResponse(404, null, 'Not found');
        }
        $user = $this->users[$id];
        foreach ($this->listeners as $listener) {
            $listener('fetched', $user);
        }
        return new ApiResponse(200, $user->toArray(), 'OK');
    }

    public function createUser(UserConfig $config): ApiResponse
    {
        if (!$config->validate()) {
            return new ApiResponse(400, null, 'Invalid config');
        }
        $id = bin2hex(random_bytes(16));
        $this->users[$id] = $config;
        foreach ($this->listeners as $listener) {
            $listener('created', $config);
        }
        return new ApiResponse(201, ['id' => $id] + $config->toArray(), 'Created');
    }

    public function updateUser(string $id, array $updates): ApiResponse
    {
        if (!isset($this->users[$id])) {
            return new ApiResponse(404, null, 'Not found');
        }
        $user = $this->users[$id];
        if (isset($updates['name'])) $user->name = $updates['name'];
        if (isset($updates['email'])) $user->email = $updates['email'];
        return new ApiResponse(200, $user->toArray(), 'Updated');
    }

    public function deleteUser(string $id): ApiResponse
    {
        if (!isset($this->users[$id])) {
            return new ApiResponse(404, null, 'Not found');
        }
        unset($this->users[$id]);
        return new ApiResponse(200, null, 'Deleted');
    }

    public function listUsers(): array
    {
        return array_map(fn(UserConfig $u) => $u->toArray(), $this->users);
    }

    public function onEvent(callable $listener): void
    {
        $this->listeners[] = $listener;
    }
}

class Utils
{
    public static function calculateHash(string $content): string
    {
        return hash('sha256', $content);
    }

    public static function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function paginate(array $items, int $page, int $perPage): array
    {
        $start = ($page - 1) * $perPage;
        $pages = (int)ceil(count($items) / $perPage);
        return [
            'items' => array_slice($items, $start, $perPage),
            'total' => count($items),
            'pages' => $pages,
        ];
    }

    public static function readConfig(string $path): ?UserConfig
    {
        if (!file_exists($path)) return null;
        $data = json_decode(file_get_contents($path), true);
        return new UserConfig(
            name: $data['name'] ?? '',
            email: $data['email'] ?? '',
            role: UserRole::tryFrom($data['role'] ?? 'viewer') ?? UserRole::Viewer,
        );
    }

    public static function writeConfig(string $path, UserConfig $config): void
    {
        file_put_contents($path, json_encode($config->toArray(), JSON_PRETTY_PRINT));
    }

    public static function retry(callable $fn, int $times, int $delayMs): mixed
    {
        for ($i = 0; $i < $times; $i++) {
            try {
                return $fn();
            } catch (Exception $e) {
                if ($i === $times - 1) throw $e;
                usleep($delayMs * 1000);
            }
        }
        return null;
    }
}
