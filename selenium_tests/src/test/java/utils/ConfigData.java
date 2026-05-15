package utils;

/**
 * ConfigData — Toutes les constantes du scénario de test
 */
public class ConfigData {

    // ── URLs ──────────────────────────────────────────────────────────────────
    public static final String BASE_URL         = "http://localhost:3000";
    public static final String LOGIN_URL        = BASE_URL + "/login";
    public static final String CHANGE_PASS_URL  = BASE_URL + "/change-password";
    public static final String USERS_URL        = BASE_URL + "/dashboard/users";
    public static final String ADMIN_DASH_URL   = BASE_URL + "/dashboard/admin";
    public static final String CLIENT_DASH_URL  = BASE_URL + "/dashboard/client";
    public static final String MANAGER_DASH_URL = BASE_URL + "/dashboard/manager";
    public static final String AUDITOR_DASH_URL = BASE_URL + "/dashboard/auditor";

    // ── ADMIN ─────────────────────────────────────────────────────────────────
    public static final String ADMIN_EMAIL = "nabil@gmail.com";
    public static final String ADMIN_PASS  = "nabil";

    // ── CLIENT ────────────────────────────────────────────────────────────────
    public static final String CLIENT_NAME     = "Client Test";
    public static final String CLIENT_EMAIL    = "client.add123@gmail.com";
    public static final String CLIENT_TEMP_PWD = "Client@123";
    public static final String CLIENT_NEW_PWD  = "ClientSecure2026@";
    public static final String CLIENT_ROLE     = "CLIENT";

    // ── MANAGER ───────────────────────────────────────────────────────────────
    public static final String MANAGER_NAME     = "Manager Test";
    public static final String MANAGER_EMAIL    = "manager.add123@gmail.com";
    public static final String MANAGER_TEMP_PWD = "Manager@123";
    public static final String MANAGER_NEW_PWD  = "ManagerSecure2026@";
    public static final String MANAGER_ROLE     = "MANAGER";

    // ── AUDITEUR ──────────────────────────────────────────────────────────────
    public static final String AUDITOR_NAME     = "Auditeur Test";
    public static final String AUDITOR_EMAIL    = "auditeur.add123@gmail.com";
    public static final String AUDITOR_TEMP_PWD = "Auditor@123";
    public static final String AUDITOR_NEW_PWD  = "AuditorSecure2026@";
    public static final String AUDITOR_ROLE     = "AUDITOR";

    // ── AUDIT ─────────────────────────────────────────────────────────────────
    public static final String AUDIT_TITLE       = "Audit Sécurité SI";
    public static final String AUDIT_DESCRIPTION = "Vérification sécurité application";

    // ── TIMEOUTS ─────────────────────────────────────────────────────────────
    public static final int DEFAULT_WAIT   = 15;  // secondes
    public static final int LONG_WAIT      = 90;  // secondes (analyse IA)

    // Document PDF de test (utilise le sample fourni dans le projet)
    public static final String SAMPLE_DOC =
        "C:\\Users\\SAMSUNG\\Desktop\\Audit_with_rag\\sample_audit_document.txt";
}
