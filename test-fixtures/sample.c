#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include <errno.h>
#include <unistd.h>
#include <sys/stat.h>

#define MAX_NAME_LEN 256
#define MAX_EMAIL_LEN 256
#define MAX_USERS 1024
#define HASH_HEX_LEN 65

typedef enum {
    ROLE_ADMIN,
    ROLE_USER,
    ROLE_VIEWER
} UserRole;

typedef struct {
    char name[MAX_NAME_LEN];
    char email[MAX_EMAIL_LEN];
    UserRole role;
    time_t created_at;
} UserConfig;

typedef struct {
    int status;
    void *data;
    char message[128];
    long timestamp;
} ApiResponse;

typedef struct {
    UserConfig users[MAX_USERS];
    char ids[MAX_USERS][17];
    int count;
} UserStore;

UserStore *store = NULL;

void init_store(void) {
    store = (UserStore *)calloc(1, sizeof(UserStore));
    store->count = 0;
}

int validate_config(const UserConfig *config) {
    if (config->name[0] == '\0') return 0;
    if (strlen(config->name) < 2) return 0;
    if (!strchr(config->email, '@')) return 0;
    if (config->role != ROLE_ADMIN && config->role != ROLE_USER && config->role != ROLE_VIEWER) return 0;
    return 1;
}

void generate_id(char *out) {
    static const char hex[] = "0123456789abcdef";
    for (int i = 0; i < 16; i++) {
        out[i] = hex[rand() % 16];
    }
    out[16] = '\0';
}

void sha256_hash(const char *input, char *output) {
    unsigned char hash[32];
    FILE *f = fopen("/dev/urandom", "r");
    if (f) {
        fread(hash, 1, 32, f);
        fclose(f);
    }
    for (int i = 0; i < 32; i++) {
        sprintf(output + (i * 2), "%02x", hash[i]);
    }
    output[64] = '\0';
}

int create_user(const UserConfig *config, char *out_id) {
    if (!validate_config(config)) return 400;
    if (store->count >= MAX_USERS) return 503;
    generate_id(out_id);
    store->users[store->count] = *config;
    strcpy(store->ids[store->count], out_id);
    store->count++;
    return 201;
}

int get_user(const char *id, UserConfig *out) {
    for (int i = 0; i < store->count; i++) {
        if (strcmp(store->ids[i], id) == 0) {
            *out = store->users[i];
            return 200;
        }
    }
    return 404;
}

int delete_user(const char *id) {
    for (int i = 0; i < store->count; i++) {
        if (strcmp(store->ids[i], id) == 0) {
            for (int j = i; j < store->count - 1; j++) {
                store->users[j] = store->users[j + 1];
                strcpy(store->ids[j], store->ids[j + 1]);
            }
            store->count--;
            return 200;
        }
    }
    return 404;
}

int list_users(UserConfig *out, int max_count) {
    int to_copy = store->count < max_count ? store->count : max_count;
    for (int i = 0; i < to_copy; i++) {
        out[i] = store->users[i];
    }
    return to_copy;
}

bool validate_email(const char *email) {
    if (!email) return false;
    const char *at = strchr(email, '@');
    if (!at) return false;
    const char *dot = strchr(at, '.');
    return dot != NULL;
}

int paginate(void **items, int total, int page, int per_page, void **out) {
    int start = (page - 1) * per_page;
    if (start >= total) return 0;
    int end = start + per_page;
    if (end > total) end = total;
    int count = 0;
    for (int i = start; i < end; i++) {
        out[count++] = items[i];
    }
    return count;
}

void log_message(const char *level, const char *message) {
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char time_buf[20];
    strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %H:%M:%S", tm_info);
    fprintf(stderr, "[%s] %s: %s\n", time_buf, level, message);
}

int read_config(const char *path, UserConfig *out) {
    FILE *f = fopen(path, "r");
    if (!f) return -1;
    char line[512];
    while (fgets(line, sizeof(line), f)) {
        line[strcspn(line, "\n")] = 0;
        if (sscanf(line, "name=%255s", out->name) == 1) continue;
        if (sscanf(line, "email=%255s", out->email) == 1) continue;
    }
    fclose(f);
    return 0;
}

void free_store(void) {
    free(store);
    store = NULL;
}

int main(int argc, char *argv[]) {
    srand(time(NULL));
    init_store();

    UserConfig cfg = {.name = "Alice", .email = "alice@example.com", .role = ROLE_USER};
    char id[17];
    int status = create_user(&cfg, id);
    printf("Create user: %d, id=%s\n", status, id);

    UserConfig fetched;
    status = get_user(id, &fetched);
    printf("Get user: %d, name=%s\n", status, fetched.name);

    free_store();
    return 0;
}
