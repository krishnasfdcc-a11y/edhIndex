#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <optional>
#include <functional>
#include <fstream>
#include <sstream>
#include <chrono>
#include <random>
#include <algorithm>
#include <iomanip>
#include <cassert>
#include <stdexcept>

using namespace std;

enum class UserRole { Admin, User, Viewer };

string roleToString(UserRole role) {
    switch (role) {
        case UserRole::Admin: return "admin";
        case UserRole::User: return "user";
        case UserRole::Viewer: return "viewer";
    }
    return "unknown";
}

struct UserConfig {
    string name;
    string email;
    UserRole role;
    map<string, string> settings;
    chrono::system_clock::time_point created_at;

    UserConfig() : role(UserRole::Viewer), created_at(chrono::system_clock::now()) {}

    UserConfig(string name, string email, UserRole role)
        : name(move(name)), email(move(email)), role(role),
          created_at(chrono::system_clock::now()) {}

    bool validate() const {
        if (name.empty() || name.length() < 2) return false;
        if (email.find('@') == string::npos) return false;
        return true;
    }
};

template<typename T>
struct ApiResponse {
    int status;
    optional<T> data;
    string message;
    long long timestamp;

    ApiResponse(int status, optional<T> data, string message)
        : status(status), data(move(data)), message(move(message)),
          timestamp(chrono::duration_cast<chrono::milliseconds>(
              chrono::system_clock::now().time_since_epoch()).count()) {}
};

class BaseService {
protected:
    string base_url;
    int timeout_ms;

public:
    BaseService(string base_url, int timeout = 5000)
        : base_url(move(base_url)), timeout_ms(timeout) {}

    virtual ~BaseService() = default;

    void log(const string& method, const string& path) {
        cout << "[" << method << "] " << base_url << path << endl;
    }
};

class UserService : public BaseService {
private:
    map<string, UserConfig> users;
    vector<function<void(const UserConfig&)>> listeners;
    mt19937 rng;

public:
    UserService() : BaseService("https://api.example.com/users"),
        rng(chrono::steady_clock::now().time_since_epoch().count()) {}

    ApiResponse<UserConfig> getUser(const string& id) {
        auto it = users.find(id);
        if (it == users.end()) {
            return {404, nullopt, "Not found"};
        }
        for (auto& listener : listeners) {
            listener(it->second);
        }
        return {200, it->second, "OK"};
    }

    ApiResponse<UserConfig> createUser(const UserConfig& config) {
        if (!config.validate()) {
            return {400, nullopt, "Invalid config"};
        }
        string id = generateId();
        users[id] = config;
        for (auto& listener : listeners) {
            listener(config);
        }
        return {201, config, "Created"};
    }

    ApiResponse<UserConfig> updateUser(const string& id, const map<string, string>& updates) {
        auto it = users.find(id);
        if (it == users.end()) {
            return {404, nullopt, "Not found"};
        }
        auto& user = it->second;
        auto nameIt = updates.find("name");
        if (nameIt != updates.end()) user.name = nameIt->second;
        auto emailIt = updates.find("email");
        if (emailIt != updates.end()) user.email = emailIt->second;
        return {200, user, "Updated"};
    }

    ApiResponse<nullopt_t> deleteUser(const string& id) {
        auto it = users.find(id);
        if (it == users.end()) {
            return {404, nullopt, "Not found"};
        }
        users.erase(it);
        return {200, nullopt, "Deleted"};
    }

    vector<UserConfig> listUsers() const {
        vector<UserConfig> result;
        for (const auto& [id, user] : users) {
            result.push_back(user);
        }
        return result;
    }

    void onEvent(function<void(const UserConfig&)> listener) {
        listeners.push_back(move(listener));
    }

private:
    string generateId() {
        uniform_int_distribution<int> dist(0, 15);
        stringstream ss;
        for (int i = 0; i < 16; i++) {
            ss << hex << dist(rng);
        }
        return ss.str();
    }
};

string calculateHash(const string& content) {
    hash<string> hasher;
    stringstream ss;
    ss << hex << hasher(content);
    return ss.str();
}

bool validateEmail(const string& email) {
    auto at = email.find('@');
    if (at == string::npos) return false;
    auto dot = email.find('.', at);
    return dot != string::npos;
}

template<typename T>
struct PaginatedResult {
    vector<T> items;
    size_t total;
    size_t pages;
};

template<typename T>
PaginatedResult<T> paginate(const vector<T>& items, size_t page, size_t perPage) {
    size_t start = (page - 1) * perPage;
    size_t end = min(start + perPage, items.size());
    size_t pages = items.empty() ? 0 : (items.size() + perPage - 1) / perPage;
    vector<T> pageItems(items.begin() + start, items.begin() + end);
    return {pageItems, items.size(), pages};
}

UserConfig readConfig(const string& path) {
    ifstream file(path);
    if (!file.is_open()) {
        throw runtime_error("Cannot open file: " + path);
    }
    UserConfig config;
    string line;
    while (getline(file, line)) {
        if (line.find("name=") == 0) config.name = line.substr(5);
        if (line.find("email=") == 0) config.email = line.substr(6);
    }
    return config;
}

void writeConfig(const string& path, const UserConfig& config) {
    ofstream file(path);
    if (!file.is_open()) {
        throw runtime_error("Cannot write file: " + path);
    }
    file << "name=" << config.name << endl;
    file << "email=" << config.email << endl;
    file.close();
}

int main() {
    UserService service;
    UserConfig alice("Alice", "alice@example.com", UserRole::Admin);
    auto result = service.createUser(alice);
    cout << "Created: " << result.message << endl;
    return 0;
}
