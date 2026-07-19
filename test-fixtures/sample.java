package com.example.index;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;
import java.util.stream.*;

public class Sample {

    public enum UserRole {
        ADMIN, USER, VIEWER
    }

    public static class UserConfig {
        private String name;
        private String email;
        private UserRole role;
        private Map<String, Object> settings;

        public UserConfig(String name, String email, UserRole role) {
            this.name = name;
            this.email = email;
            this.role = role;
            this.settings = new HashMap<>();
        }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public UserRole getRole() { return role; }
        public void setRole(UserRole role) { this.role = role; }
    }

    public static class ApiResponse<T> {
        private int status;
        private T data;
        private String message;
        private long timestamp;

        public ApiResponse(int status, T data, String message) {
            this.status = status;
            this.data = data;
            this.message = message;
            this.timestamp = Instant.now().toEpochMilli();
        }

        public int getStatus() { return status; }
        public T getData() { return data; }
        public String getMessage() { return message; }
        public long getTimestamp() { return timestamp; }
    }

    public interface Service {
        <T> ApiResponse<T> handle(T data);
    }

    public static class UserService implements Service {
        private final Map<String, UserConfig> users = new ConcurrentHashMap<>();
        private final List<Consumer<UserConfig>> listeners = new CopyOnWriteArrayList<>();

        public ApiResponse<UserConfig> getUser(String id) {
            UserConfig user = users.get(id);
            if (user == null) {
                return new ApiResponse<>(404, null, "Not found");
            }
            listeners.forEach(l -> l.accept(user));
            return new ApiResponse<>(200, user, "OK");
        }

        public ApiResponse<UserConfig> createUser(UserConfig config) {
            if (!validateConfig(config)) {
                return new ApiResponse<>(400, null, "Invalid config");
            }
            String id = generateId();
            users.put(id, config);
            return new ApiResponse<>(201, config, "Created");
        }

        public ApiResponse<UserConfig> updateUser(String id, Map<String, String> updates) {
            UserConfig user = users.get(id);
            if (user == null) {
                return new ApiResponse<>(404, null, "Not found");
            }
            if (updates.containsKey("name")) user.setName(updates.get("name"));
            if (updates.containsKey("email")) user.setEmail(updates.get("email"));
            return new ApiResponse<>(200, user, "Updated");
        }

        public ApiResponse<Void> deleteUser(String id) {
            if (users.remove(id) == null) {
                return new ApiResponse<>(404, null, "Not found");
            }
            return new ApiResponse<>(200, null, "Deleted");
        }

        public List<UserConfig> listUsers() {
            return new ArrayList<>(users.values());
        }

        public void onEvent(Consumer<UserConfig> listener) {
            listeners.add(listener);
        }

        private boolean validateConfig(UserConfig config) {
            if (config.getName() == null || config.getName().isEmpty()) return false;
            if (!config.getEmail().contains("@")) return false;
            return true;
        }

        private String generateId() {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] hash = md.digest(String.valueOf(System.nanoTime()).getBytes());
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) hex.append(String.format("%02x", b));
                return hex.substring(0, 16);
            } catch (NoSuchAlgorithmException e) {
                return UUID.randomUUID().toString();
            }
        }
    }

    public static String calculateHash(String content) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(content.getBytes("UTF-8"));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static boolean validateEmail(String email) {
        return email != null && email.contains("@") && email.contains(".");
    }

    public static <T> PaginatedResult<T> paginate(List<T> items, int page, int perPage) {
        int start = (page - 1) * perPage;
        int end = Math.min(start + perPage, items.size());
        int pages = (int) Math.ceil((double) items.size() / perPage);
        return new PaginatedResult<>(items.subList(start, end), items.size(), pages);
    }

    public static class PaginatedResult<T> {
        public final List<T> items;
        public final int total;
        public final int pages;

        public PaginatedResult(List<T> items, int total, int pages) {
            this.items = items; this.total = total; this.pages = pages;
        }
    }

    public static String readFile(String path) throws IOException {
        return Files.readString(Path.of(path));
    }

    public static void writeFile(String path, String content) throws IOException {
        Files.writeString(Path.of(path), content);
    }
}
